const Vec2 = require('./modules/util.js').Vec2;
const Level = require('./modules/level.js');
const handleInput = require('./modules/input.js').input;
const clearInput = require('./modules/input.js').clear;

const entities = require('./modules/entities.js');

const express = require('express');
const http = require('http');

const port = process.env.PORT || 4001;
const index = require("./routes/index");

const interval = 1000/25; //Server broadcast rate
const delta = 1000/60; //Server physics frame rate


//slight change
const app = express();
app.use(index);

const server = http.createServer(app);

const socketIo = require('socket.io');
const level = new Level();

const matches = {};
const matchIdsByWallet = {};
const liveMatches = [];

const io = new socketIo.Server(server, {
    cors: {
        origin: [
            "https://youthful-keller-2f50ca.netlify.app",
            "http://localhost:3000"
        ],
        methods: ["GET", "POST"]
    }
});

//Called upon establishment of a new collection
io.on("connection", socket => {
    //Default Values per player instance
    socket.userData = { pos: new Vec2(0,0), vel: new Vec2(0,0), heading: 0, dir: 0 };
    console.log(`${socket.id} connected`);

    socket.on('setWallet', data => {
        socket.userData.wallet = data;
    });

    socket.on('getGameId', cb => {
        let id = null;
        if (matchIdsByWallet[socket.userData.wallet]) id = matchIdsByWallet[socket.userData.wallet];
        if (typeof cb === "function")
        cb(id);
    });

    socket.on('requestGame', cb => {
        var gameId = (( Math.random() * 99999 ) | 0) + 1;
        if (typeof cb === "function")
        cb(gameId);
    });

    socket.on('fetchData', cb => {
        const data = matches[matchIdsByWallet[socket.userData.wallet]].players[socket.userData.wallet];
        if (typeof cb === "function")
        cb({
            pos: data ? data.pos : new Vec2(640,0),
            vel: data ? data.vel : new Vec2(0,0),
            facing: data ? data.facing : 1,
        });
    })

    socket.on('fetchMatches', cb => {
        if (typeof cb === "function")
        cb(JSON.stringify(liveMatches));
    })

    socket.on('createGame', gameId => {
        socket.join(gameId);

        matchIdsByWallet[socket.userData.wallet] = gameId;
        matches[gameId] = {};
        matches[gameId].level = new Level();
        matches[gameId].players = {};
        liveMatches.push(gameId);

        matches[gameId].sendPackets = startBroadcast(gameId);
        matches[gameId].update = startGameInstance(gameId);
    })

    socket.on('endGame', data => {
        var filtered = liveMatches.filter(function(value, index, arr){
            if (value == matches[data.room]) liveMatches.splice(index, 1);
        });
        matches[data.room] = null;
        io.sockets.in(data.room).emit('leave', data.room);
        clearInterval(matches[data.gameId].sendPackets);
        clearInterval(matches[data.gameId].update);
    });

    socket.on('joinGame', data => {
        if (matchIdsByWallet[socket.userData.wallet]) {
            const player = matches[matchIdsByWallet[socket.userData.wallet]].players[socket.userData.wallet];
            if (player && player.socketID != null) {
                io.sockets.sockets.get(player.socketID).disconnect();
            }
        }
        socket.join(data);
        matchIdsByWallet[socket.userData.wallet] = data;
    });

    socket.on('leaveGame', data => {
        socket.leave(data);
        matches[matchIdsByWallet[socket.userData.wallet]].players[socket.userData.wallet] = null;
        matchIdsByWallet[socket.userData.wallet] = null;
        socket.broadcast.emit('deletePlayer', { id: socket.userData.wallet });
    })
    //Initializes server framework for storing a player state
    socket.on('init', data => {

        const player = matches[matchIdsByWallet[socket.userData.wallet]].players[socket.userData.wallet];

        socket.userData.hp = player ? player.hp : data.hp;
        socket.userData.pos = player ? player.pos : data.pos;
        socket.userData.vel = player ? player.vel : data.vel;
        socket.userData.heading = data.h;
        socket.userData.pb = data.pb;
        socket.userData.command = null;
        socket.userData.facing = player ? player.facing : 1;
        newPlayer(data, socket);
        socket.broadcast.emit('addPlayer', {
            skeleton: data.skeleton,
            id: socket.id
        });
    });

    //Triggers client callback for latency calculation upon ping requests
    socket.on("ping", (cb) => {
        if (typeof cb === "function")
        cb();
    });

    //Mirror player animations from client
    socket.on('animation', data => {
        matches[matchIdsByWallet[socket.userData.wallet]].players[socket.userData.wallet].animation = data;
    });

    //Handle removing players from client worlds
    socket.on("disconnect", () => {
        if (matchIdsByWallet[socket.userData.wallet]){
            const player = matches[matchIdsByWallet[socket.userData.wallet]].players[socket.userData.wallet];
            player.socketID = null;
            clearInput(player, socket);
            console.log(`Player ${socket.userData.wallet} lost connection`);
        } else {
            console.log(`Client ${socket.id} disconnected`);
        }
    });

    socket.on("chat message", msg => {
        console.log(msg);
    });

    //Loads map data server-side upon room creation
    socket.on("loadLevel", levelData => {
        if (matches[levelData.room].level.data) return;
        matches[levelData.room].level.data = levelData.data;
        matches[levelData.room].level.loadCollisionData();
    })
});

//Add a new player entity to the server state for authoratative physics
const newPlayer = (data, socket) => {
    const player = entities.createChar(socket);
    const match = matches[matchIdsByWallet[socket.userData.wallet]];

    console.log('player ' + socket.userData.wallet + ' joined');

    match.players[socket.userData.wallet] = player;
    player.socketID = socket.id;
    player.skeleton = data.skeleton;
    player.pos = data.pos;
    player.vel = data.vel;
    player.animation = {
        name: "Idle",
        loop: true
    }
    match.level.entities.add(player);
    match.level.addInteractiveEntity(player);
    handleInput(player, socket);
}

//Create a packet for the server-side player data, and broadcast it at a set rate of 'interval' ms
const startBroadcast = (room) => {
    return setInterval(async () => {
        let pack = {};

        const roster = await io.in(room).fetchSockets();

        const playerIDs = Object.keys(matches[room].players);
        for (const ID of playerIDs) {
            pack[ID] = {
                hp: matches[room].players[ID].hp,
                skeleton: matches[room].players[ID].skeleton,
                pos: matches[room].players[ID].pos,
                vel: matches[room].players[ID].vel,
                command: matches[room].players[ID].command,
                heading: matches[room].players[ID].heading,
                facing: matches[room].players[ID].facing,
                grounded: matches[room].players[ID].isGrounded,
                animation: matches[room].players[ID].animation,
                hurtTime: matches[room].players[ID].hurtTime,
                hitSource: matches[room].players[ID].hitSource,
            }
        }
        if (Object.keys(pack).length > 0) io.to(room).emit('remoteData', pack);
    }, interval);
}


//Server-side game loop, performs authoratative physics calculations at a set rate of 'delta' ms
let lastTime = Date.now();
let accumulatedTime = 0;

const startGameInstance = (room) => {
    return setInterval(() => {
        const time = Date.now();
        let deltaTime = time - lastTime;

        accumulatedTime += deltaTime;
        lastTime = time;

        while (accumulatedTime > delta) {
            matches[room].level.update(delta/1000);
            accumulatedTime -= delta;
        }
    }, delta);
}

//Start server
server.listen(port, () => console.log(`Listening on port ${port}`));
