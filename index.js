/*jshint node:true*/

//------------------------------------------------------------------------------
// node.js starter application for Bluemix
//------------------------------------------------------------------------------

// This application uses express as it's web server
// for more info, see: http://expressjs.com
var express = require('express');
var http = require("http");
var app = express();
var port = 5000;
var debug = true;

var server = http.createServer(app);
//server.listen(port);

// cfenv provides access to your Cloud Foundry environment
// for more info, see: https://www.npmjs.com/package/cfenv
var cfenv = require('cfenv');

// create a new express server
// serve the files out of ./public as our main files
app.use(express.static(__dirname + '/public'));

// get the app environment from Cloud Foundry
var appEnv = cfenv.getAppEnv();

// start server on the specified port and binding host
app.listen(appEnv.port, appEnv.bind, function() {
	// print a message when the server starts listening
	log("server starting on " + appEnv.url);
	var wss = new WebSocketServer({server: server});
	console.log("websocket server created");
});

var ROW_NONE = 0;
var ROW_LEFT_PADDLE = 1;
var ROW_RIGHT_PADDLE = 2;

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

// Variable responsible for holding all connections
var connections = [];

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
	newConnection.uuid = game.uuid;
	newConnection.nick = "UNKNOWN";
	newConnection.row = ROW_NONE;

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
						uuid:uuid
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
		if (message.rowForce)
		{
			connection.rowForce = message.rowForce;
		}
	});
}

function calculateBoatMovement()
{
	var left = 0;
	var right = 0;
	var leftForce = [-1, 1];
	var rightForce = [1, 1];
	var totalForce = [0, 0];

	for (var i = 0; i < connections.length; i++)
	{
		if (connections[i].row == ROW_LEFT_PADDLE)
		{
			right++;
			totalForce[0] += right[0] / connections.length;
			totalForce[1] += right[1] / connections.length;
		}
		else if (connections[i].row == ROW_RIGHT_PADDLE)
		{
			left++;
			totalForce[0] += left[0] / connections.length;
			totalForce[1] += left[1] / connections.length;
		}
	}
	// Total number of people rowing at the moment
	for (var i = 0; i < connections.length; i++)
	{
		newConnection.send(JSON.stringify(
		{
			message_boatUpdate:{
				boatPos : boat.pos,
				boatRot : boat.rotation
			}
		}));
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
		playerPositions:{
			nrPlayers:positions.length,
			positions:positions,
			IDs:IDs}});
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
				
	}

	deactivate : function(client) {

	}
};

var RESTARTING = {
	activate : function(client) {
		boat.reset();
		// Send info to players to reset

	}

	deactivate : function(client) {

	}
}

try {
	wws.on("connection", function(connection){
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
}, 33);

// Run code with a given interval
function log(msg) {
    if (debug) {
        console.log("SRV: " + msg);
    }
}