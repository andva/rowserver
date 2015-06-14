var WebSocketServer = require("ws").Server
var http = require("http")
var express = require("express")
var app = express()
var port = process.env.PORT || 5000

app.use(express.static(__dirname + "/"))

var server = http.createServer(app)
server.listen(port)

console.log("http server listening on %d", port)

var connections = [];

var uuid = 0;

var wss = new WebSocketServer({server: server})
console.log("websocket server created")

var boat = {
	pos : [0, 0],
	rotation : 0,

	reset : function() {
		for (var i = 0; i < 2; i++)
		{
			pos[i] = 0;
		}
		rotation = 0;
	}
}


// Storing game states
var game = {
	uuid : 0,
	state : RESTARTING,
}

// Activates a state on the server
function activateState(state) {
    console.log('switching from', game.state.name, 'to', state.name)
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
		newConnection.row = [0,0];

		console.log('Adding player (' +game.uuid+ ')');

		var otherPlayers = [];
		var names = [];

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

	
		newConnection.send(JSON.stringify(
		{
			message_initPlayer:{
				seatNr:connections.length,
				nrPlayers:connections.length + 1
			}
		}));
		connections.push(newConnection);
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
	});
}

function onMessage(connection)
{
	connection.on("message", function(data) {
		var message = JSON.parse(data);
		log('msg:', message , ", ", data, ", ", message.rowForceX);
		if (message.rowForceX)
		{
			log('Row force!!');
			connection.rowForce[0] = message.rowForceX;
			connection.rowForce[1] = message.rowForceY;
		}
		if (message.asd == 1)
		{
			log('ROW!');
		}
	});
	connection.on("message_applyForce", function(data) {
		var message = JSON.parse(data);
		log('msg_applyForce ', message.rowForce);
		connection.rowForce[0] = message.rowForce[0];
		connection.rowForce[1] = message.rowForce[1];
	});
}

function calculateBoatMovement()
{
	var totalForce = [0, 0];
	for (var i = 0; i < connections.length; i++)
	{
		totalForce[0] += connections[i].row[0];
		totalForce[1] += connections[i].row[1];
	}
	boat.pos[0] += totalForce[0];
	boat.pos[1] += totalForce[1];

	boat.rotation += totalForce[0] / 2.0;
	if (boat.rotation < 0) {
		boat.rotation += 2 * Math.PI;
	}
	if (boat.rotation >= 2 * Math.PI) {
		boat.rotation -= 2 * Math.PI;
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

	activate : function(client) {
				
	},

	deactivate : function(client) {

	}
};

var RESTARTING = {
	activate : function(client) {
		boat.reset();
		// Send info to players to reset

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