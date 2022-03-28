import React from 'react';
import { useEffect, useState, useRef, useContext } from 'react';
import useScript from './hooks/useScript.js';
import Remote from './modules/remote.js';

import PerformanceOverlay from './modules/benchmarkOverlay.js';

import { Stage, Sprite, PixiComponent  } from '@inlet/react-pixi'
import { ReferenceDataContext } from "./ReferenceDataContext";

import { createChar } from './modules/entities.js';
import Camera from './modules/camera.js';

import { Keyboard, KeyCodes } from './modules/input.js';
import { bindKeys, bindKeysServer } from './modules/controls.js';
import * as PIXI from "pixi.js";

import { Spine } from 'pixi-spine';

const physics = require("./modules/physics.js");
const assetManager = require("./modules/assets.js");
const animationManager = require("./modules/animation.js");
const layerManager = require("./modules/layers.js");

const loader = PIXI.Loader.shared;

//Scaling Settings
const baseWidth = 1920;
const baseHeight = 1080;

//Game Loop & logic for single player
export function Game() {
    const [response, setResponse] = useState("");

    //Canvas/Screen Buffer
    const screenRef = useRef();
    const [gScale, setGScale] = useState(1);
    const [gWidth, setGWidth] = useState();
    const [gHeight, setGHeight] = useState();
    const [testLevel, setTestLevel] = useState();

    const [level, setLevel] = useState();
    const [comp, setComp] = useState();
    const [clock, setClock] = useState(0);

    const [camera, setCamera] = useState(new Camera());

    let gameLoop = useRef();

    const getScale = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;

        var scaler = h/14;
        scaler = Math.max(24, scaler)/64;

        return scaler;
    }

    const animation = (app) => {
        var spineLoaderOptions = { metadata: { spineSkeletonScale: 1 } };
        app.loader.add('playerSkel','res/avatars/Game Ready/Bobbleheads.json', spineLoaderOptions);
    }

    const createSkeleton = (app, resources) => {
        let res = new Spine(resources.playerSkel.spineData);
        return res;
    }

    //Initializes game on page load, after fetching required data from the server
    useEffect(() => {

        const serverState = new Remote();

        const app = new PIXI.Application({
            width: window.innerWidth,
            height: window.innerHeight,
            resizeTo: window,
            backgroundColor: 0x87CEEB,
            antialias: true
        });

        const loadMap = assetManager.loadLevel(app, 1);

        const c = new Camera();

        document.body.appendChild(app.view);

        animation(app);

        app.loader.load((loader, resources) => {
            const bh = createSkeleton(app, resources);
            const dummy = createSkeleton(app, resources);
            animationManager.bobbleheadMix(bh);
            animationManager.bobbleheadMix(dummy);

            Promise.all([loadMap,createChar(0), createChar(0)])
            .then(([map, char, prop]) => {
                char.skeleton = bh;
                prop.skeleton = dummy;

                //Loads keyboard handling logic
                const input = new Keyboard();
                let lastTime = 0;
                let accumulatedTime = 0;
                let delta = 1/60;

                //Defines keybinds
                bindKeys(char,input,window);

                map.entities.add(char);
                map.entities.add(prop);

                char.drawHP(app);
                prop.drawHP(app);

                map.addInteractiveEntity(char);
                map.addInteractiveEntity(prop);

                //Define the game loop update/render logic
                const update = (time) => {
                    map.render(c);

                    //Compares real elapsed time with desired logic/physics framerate to maintain consistency
                    //accumulatedTime marks how many seconds have passed since the last logic update
                    accumulatedTime += (time - lastTime)/1000;
                    lastTime = time;

                    while (accumulatedTime > delta) {
                        const SCALE = getScale();
                        c.setSize(
                            window.innerWidth/SCALE,
                            window.innerHeight/SCALE,
                            SCALE
                        );
                        c.update(char, map, delta);
                        map.update(delta);
                        accumulatedTime -= delta;
                    }
                    gameLoop.current = requestAnimationFrame(update);
                }
                gameLoop.current = requestAnimationFrame(update);
            });
        });
    }, []);

    return (
        <div className='nobar' />
    )
}

//Game loop & logic for multiplayer
export function OnlineGame() {
    const [response, setResponse] = useState("");

    //Canvas/Screen Buffer
    const screenRef = useRef();
    const [gScale, setGScale] = useState(1);
    const [gWidth, setGWidth] = useState();
    const [gHeight, setGHeight] = useState();
    const [testLevel, setTestLevel] = useState();

    const [level, setLevel] = useState();
    const [comp, setComp] = useState();
    const [clock, setClock] = useState(0);
    const [latency, setLatency] = useState(0);

    const [camera, setCamera] = useState(new Camera());

    const { server, currentAccount } = useContext(ReferenceDataContext);

    let gameLoop = useRef();

    const getScale = () => {
        const w = window.innerWidth;
        const h = window.innerHeight;

        var scaler = h/14;
        scaler = Math.max(24, scaler)/64;

        return scaler;
    }

    const animation = (app) => {
        var spineLoaderOptions = { metadata: { spineSkeletonScale: 1 } };
        app.loader.add('playerSkel','res/avatars/Game Ready/Bobbleheads.json', spineLoaderOptions);
    }

    const createSkeleton = (app, resources) => {
        let res = new Spine(resources.playerSkel.spineData);
        return res;
    }

    const initPlayerOnServer = (entity, serverState) => {
        const remotePlayer = serverState.initialData;
        if (remotePlayer){
            entity.pos.set(remotePlayer.pos.x, remotePlayer.pos.y);
            entity.facing = remotePlayer.facing;
        }

        const data = {
            hp: entity.hp,
            skeleton: 0,
            pos: entity.pos,
            vel: entity.vel,
            command: entity.command,
            heading: entity.heading,
            pb: entity.pb,
            dir: entity.dir,
            facing: entity.facing,
        }
        server.emit('init', data);
    }

    const checkForPlayers = (app, container, char, level, socket, serverState) => {
        server.on('addPlayer', data => {
            if (!serverState.players[data.id]) {
                createChar(data.skeleton, data.id, socket, false, serverState).then((player) => {
                    newPlayer(app, level, player);
                    serverState.players[data.id] = player;
                });
            }
        });

        server.on('deletePlayer', data => {
            if (serverState.players[data.id]) {
                const player = serverState.players[data.id];
                player.destroy();
                level.entities.delete(player);
                serverState.players[data.id] = null;
            }
        });

        server.on('gameId', id => {
            if(id){
                server.emit('joinGame', {
                    id: id,
                    wallet: currentAccount
                });
            }
        })

        server.on('setGameId', id => {
            //PLACE METAMASK TRANSACTION FOR CREATING MATCH HERE
            server.emit('joinGame', {
                id: id,
                wallet: currentAccount
            });
        })

        server.on('leave', id => {
            server.emit('leaveGame', {
                id: id,
                wallet: '0x3e05c7FFfEfe9030523c1eb14E50ace5B0da9Cf7'
            })
        })

        server.on('remoteData', data => {
            serverState.remoteData = data;
            serverState.lastUpdate = Date.now();
            Object.entries(serverState.remoteData).forEach((item) => {
                const key = item[0];
                const userData = item[1];
                if (!serverState.players[key]) {
                    serverState.players[key] = {};
                    createChar(userData.skeleton, key, server, false, serverState).then((player) => {
                        newPlayer(app, container, level, player);
                        player.pos.set(userData.pos.x, userData.pos.y)
                        player.hp = userData.hp;
                        player.facing = userData.facing;
                        serverState.players[key] = player;
                    });
                }
            })
        });
    }

    const newPlayer = (app, container, level, player) => {
        const bh = createSkeleton(app, app.loader.resources);
        animationManager.bobbleheadMix(bh);
        player.skeleton = bh;

        container.addChild(player.container);
        player.draw();

        level.entities.add(player);
        level.addInteractiveEntity(player);
    }

    const beginPing = (stats) => {
        setInterval(() => {
            const start = Date.now();
            // volatile, so the packet will be discarded if the socket is not connected
            server.volatile.emit("ping", () => {
                const PING = Date.now() - start;
                stats.latency.text = 'PING: ' + PING + 'ms';
            });
        }, 2500);
    }

    //Initializes game on page load, after fetching required data from the server
    useEffect(async () => {
        const app = new PIXI.Application({
            width: window.innerWidth,
            height: window.innerHeight,
            resizeTo: window,
            backgroundColor: 0x87CEEB,
            antialias: true,
        });

        const serverState = new Remote();

        await server.emit('getGameId', (id) => {
            serverState.gameId = id;
            server.emit('fetchData', (data) => {
                serverState.initialData = data;
                const worldLayer = new PIXI.Container();
                const entityLayer = new PIXI.Container();

                const statsHud = new PerformanceOverlay(serverState.gameId);
                beginPing(statsHud);

                app.stage.addChild(worldLayer);
                app.stage.addChild(entityLayer);
                app.stage.addChild(statsHud.container);

                const loadMap = assetManager.loadLevel(app, worldLayer, 1);
                const c = new Camera();

                document.body.appendChild(app.view);

                animation(app);

                app.loader.load((loader, resources) => {
                    const bh = createSkeleton(app, resources);
                    //const dummy = createSkeleton(app, resources);
                    animationManager.bobbleheadMix(bh);
                    //animationManager.bobbleheadMix(dummy);

                    Promise.all([loadMap,createChar(0, currentAccount, server, serverState, true)])
                    .then(([map, char]) => {
                        entityLayer.addChild(char.container);

                        serverState.players[currentAccount] = char;
                        char.skeleton = bh;
                        server.emit('loadLevel', {
                            data: map.data,
                            room: serverState.gameId
                        })
                        //prop.skeleton = dummy;

                        initPlayerOnServer(char, serverState);

                        //Loads keyboard handling logic
                        const input = new Keyboard();
                        let lastTime = 0;
                        let accumulatedTime = 0;
                        let delta = 1/60;

                        //Defines keybinds
                        bindKeysServer(char,input,window, server);


                        map.entities.add(char);
                        //map.entities.add(prop);

                        char.draw();
                        //prop.drawHP(app);

                        map.addInteractiveEntity(char);
                        //map.addInteractiveEntity(prop);
                        checkForPlayers(app, entityLayer, char, map, server, serverState);

                        //Define the game loop update/render logic
                        const update = (time) => {
                            map.render(c);
                            statsHud.update((time - lastTime)/1000);

                            //Compares real elapsed time with desired logic/physics framerate to maintain consistency
                            //accumulatedTime marks how many seconds have passed since the last logic update
                            accumulatedTime += (time - lastTime)/1000;
                            lastTime = time;

                            while (accumulatedTime > delta) {
                                const SCALE = getScale();
                                c.setSize(
                                    window.innerWidth/SCALE,
                                    window.innerHeight/SCALE,
                                    SCALE
                                );
                                c.update(char, map, delta);
                                map.update(delta, serverState);
                                accumulatedTime -= delta;
                            }
                            gameLoop.current = requestAnimationFrame(update);
                        }
                        gameLoop.current = requestAnimationFrame(update);
                    });
                });
            });
        })

        //Cleanup on dismount
        return () => {
            if (server)
            server.disconnect();
            app.stage.destroy();
        }
    }, []);

    return (
        <div className='nobar' />
    )
}
