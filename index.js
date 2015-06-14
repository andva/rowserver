var WebSocketServer = require("ws").Server
var http = require("http")
var express = require("express")
var app = express()
var port = process.env.PORT || 5000

app.use(express.static(__dirname + "/"))

var server = http.createServer(app)
server.listen(port)

log("http server listening on %d", port)

var connections = [];

var uuid = 0;

var wss = new WebSocketServer({server: server})
log("websocket server created")

var boat = {
	position : [0, 0],
	rotation : 0,

	reset : function() {
		log("Resetting position");
		for (var i = 0; i < 2; i++)
		{
			boat.position[i] = 0;
		}
		boat.rotation = 0;
	}
}


// Storing game states
var game = {
	uuid : 0,
	state : RESTARTING,
}

// Activates a state on the server
function activateState(state) {
    //console.log('switching from', game.state.name, 'to', state.name)
    game.state.deactivate();
    game.state = state;
    state.activate();
}

// Add a player and emit this to everyone
function addPlayer(newConnection)
{
	if (newConnection.readyState)
	{
		newConnection.uuid = game.uuid;
		newConnection.nick = "UNKNOWN";
		newConnection.rowForce = [0,0];

		var otherPlayers = [];
		var names = [];
		/*if (boat == undefined || boat.position == undefined) {
			boat 
		}*/
		// Tell others a new person connected
		for (var i = 0; i < connections.length; i++)
		{
			otherPlayers[i] = connections[i].uuid;
			names[i] = connections[i].nick;
			if (connections[i].readyState)
			{
				connections[i].send(JSON.stringify({
					message_addPlayer:{
						nrPlayers:connections.length + 1
					}
				}));
			}
		}

		if (connections.length == 0) {
			//activateState(PLAYING);
		}
		newConnection.send(JSON.stringify(
		{
			message_initPlayer:{
				seatNr:connections.length,
				nrPlayers:connections.length + 1
			}
		}));
		connections.push(newConnection);
		log('Adding player (' +game.uuid+ ')(Tot:' + connections.length +')');
		game.uuid += 1;
	}
}

function onCloseConnection(connection)
{
	connection.on("close", function() {
		var idx = connections.indexOf(connection);
		log("Web socket connection closed");

		var uuid = connection.uuid;

		if (idx >= 0)
		{
			connections.splice(idx, 1);
		}

		for (var i = 0; i < connections.length; i++)
		{
			if (connections[i].readyState)
			{
				connections[i].send(JSON.stringify({
					message_removePlayer:{
						nrPlayers:connections.length
					}
				}));
			}
		}
		if (connections.length == 0)
		{
			boat.reset();
		}
	});
}

function onMessage(connection)
{
	connection.on("message", function(data) {
		var message = JSON.parse(data);
		if (message.applyForce)
		{
			if (message.applyForce.rowForce != undefined)
				connection.rowForce = message.applyForce.rowForce;
			else
				log("Wrong size of row force (" + message.applyForce.rowForce + ")");
		}
	});
}

function calculateBoatMovement()
{
	var totalForce = [0, 0];
	for (var i = 0; i < connections.length; i++)
	{
		var leftSide = connections[i].rowForce[0];
		var rightSide = connections[i].rowForce[1];
		totalForce[0] += rightSide - leftSide;
		if (rightSide > 0 || leftSide > 0)
			totalForce[1] += 0.2;
	}
	boat.rotation += totalForce[0] / (connections.length * 12.0);

	var cs = Math.cos(boat.rotation);
	var sn = Math.sin(boat.rotation);

	var x = -sn;
	var y = cs;
	log('x' + x + ' y' + y);
	boat.position[0] += x * 0.2;
	boat.position[1] += y * 0.2;

	if (boat.rotation < 0) {
		boat.rotation += 2 * Math.PI;
	}
	if (boat.rotation >= 2 * Math.PI) {
		boat.rotation -= 2 * Math.PI;
	}
	for (var i = 0; i < connections.length; i++)
	{
		connections[i].rowForce = [0,0];
	}
}

function pushUpdatesToClients()
{
	var IDs = [];
	var rowStatus = [];
	for (var i = 0; i < connections.length; i++)
	{
		rowStatus[i] = connections[i].row;
		IDs[i] = connections[i].uuid;
	}
	var jsonObj = JSON.stringify({
		message_boatUpdate:{
			boatPos : boat.pos,
			boatRot : boat.rotation}
		});
	for (var i = 0; i < connections.length; i++)
	{
		if (connections[i].readyState)
		{
			connections[i].send(jsonObj);
		}
	}
}

var PLAYING = {
	name : "playing",
	activate : function(client) {
				
	},

	deactivate : function(client) {

	}
};

var RESTARTING = {
	name : "restarting",
	activate : function(client) {
		//boat.reset();
		//activateState(IDLE);
	},

	deactivate : function(client) {

	}
}

var IDLE = {
	name : "idle",
	activate : function(client) {

	},

	deactivate : function(client) {

	}
}

try {
	wss.on("connection", function(connection){
		addPlayer(connection);
		onCloseConnection(connection);
		onMessage(connection);
	});
} catch (e) {
	log(e);
}

setInterval(function()
{
	if (connections.length > 0) {
		calculateBoatMovement();
		pushUpdatesToClients();
	}
}, 500);

// Run code with a given interval
function log(msg) {
  //  if (debug) {
        console.log("SRV: " + msg);
   // }
}