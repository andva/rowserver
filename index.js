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

try {
	wss.on("connection", function(connection) {
	 
	 	connection.position = [0,0];
	 	connection.uuid = uuid;
	 	connection.nick = 'Anonymous';

	 	console.log(connection.readyState)


	 	var otherPlayers = [];
	 	var names = [];
	 	for(var i = 0;i<connections.length;i++)
		{
			otherPlayers[i] = connections[i].uuid;
			names[i] = connections[i].nick;
			if(connections[i].readyState)
			connections[i].send(JSON.stringify({playerAdded:{uuid:uuid,name:'Anonymous'}}));
		}

		connection.send(JSON.stringify({playerID:{uuid:uuid,names:names,otherPlayers:otherPlayers,nrPlayers:connections.length}}));

		connections.push(connection);

		uuid++;

		console.log("websocket connection open");

		connection.on("close", function() {
			var idx = connections.indexOf(connection);
			console.log("websocket connection close");

			var uuid = connection.uuid;

			if (idx >= 0)
				connections.splice(idx,1);

			for(var i = 0;i<connections.length;i++)
			{
				if(connections[i].readyState)
				connections[i].send(JSON.stringify({playerRemove:{uuid:uuid}}));
			}
		});

		connection.on("message", function(data) {
			var message = JSON.parse(data);
			if(message.position)
			{
				connection.position = message.position;	
			}
			else if(message.nameChange)
			{
				connection.nick = message.nameChange.name;
				for(var i = 0;i<connections.length;i++)
				{
					if(connections[i].readyState)
					connections[i].send(JSON.stringify({nameChange:{uuid:connection.uuid,name:connection.nick}}));
				}
			}
			
		});
	})
} catch (e) {
	console.log(e)
}

setInterval(function()
{ 
	var positions = [];
	var IDs = [];
	for(var i = 0;i<connections.length;i++)
	{
		positions[i] = connections[i].position;
		IDs[i] = connections[i].uuid;
	}
	var jsonObj = JSON.stringify({playerPositions:{nrPlayers:positions.length,positions:positions,IDs:IDs}});
	for(var i = 0;i<connections.length;i++)
	{
		if(connections[i].readyState)
		connections[i].send(jsonObj)
	}
}, 17);