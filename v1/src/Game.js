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

import * as PIXI from 'pixi.js';

import { Spine, Skin, TextureAtlas, AtlasAttachmentLoader, SkeletonJson } from '@pixi-spine/all-4.0';

const bhTraits = require('./modules/bhTraitNames.js');

var rawSkeletonData = require("./res/avatars/Game Ready/FullChar.json"); //your skeleton.json file here
var rawAtlasData = require("./res/avatars/Game Ready/Mixable.atlas");

const preLoader = new PIXI.Loader();

const physics = require("./modules/physics.js");
const assetManager = require("./modules/assets.js");
const animationManager = require("./modules/animation.js");
const layerManager = require("./modules/layers.js");

//Scaling Settings
const baseWidth = 1920;
const baseHeight = 1080;

// //Game Loop & logic for single player
// export function Game() {
//     const [response, setResponse] = useState("");
//
//     //Canvas/Screen Buffer
//     const screenRef = useRef();
//     const [gScale, setGScale] = useState(1);
//     const [gWidth, setGWidth] = useState();
//     const [gHeight, setGHeight] = useState();
//     const [testLevel, setTestLevel] = useState();
//
//     const [level, setLevel] = useState();
//     const [comp, setComp] = useState();
//     const [clock, setClock] = useState(0);
//
//     const [camera, setCamera] = useState(new Camera());
//
//     let gameLoop = useRef();
//
//     const getScale = () => {
//         const w = window.innerWidth;
//         const h = window.innerHeight;
//
//         var scaler = h/14;
//         scaler = Math.max(24, scaler)/64;
//
//         return scaler;
//     }
//
//     const animation = (app) => {
//         app.loader.add('playerSkel','res/avatars/Game Ready/FullChar.json');
//     }
//
//     const createSkeleton = (app, resources) => {
//         let res = new Spine(resources.playerSkel.spineData);
//         return res;
//     }
//
//     //Initializes game on page load, after fetching required data from the server
//     useEffect(() => {
//
//         const serverState = new Remote();
//
//         const app = new PIXI.Application({
//             width: window.innerWidth,
//             height: window.innerHeight,
//             resizeTo: window,
//             backgroundColor: 0x87CEEB,
//             antialias: true
//         });
//
//         const loadMap = assetManager.loadLevel(app, 1);
//
//         const c = new Camera();
//
//         document.body.appendChild(app.view);
//
//         animation(app);
//
//         app.loader.load((loader, resources) => {
//             const bh = createSkeleton(app, resources);
//             const dummy = createSkeleton(app, resources);
//             animationManager.bobbleheadMix(bh);
//             animationManager.bobbleheadMix(dummy);
//
//             Promise.all([loadMap,createChar(0), createChar(0)])
//             .then(([map, char, prop]) => {
//                 char.skeleton = bh;
//                 prop.skeleton = dummy;
//
//                 //Loads keyboard handling logic
//                 const input = new Keyboard();
//                 let lastTime = 0;
//                 let accumulatedTime = 0;
//                 let delta = 1/60;
//
//                 //Defines keybinds
//                 bindKeys(char,input,window);
//
//                 map.entities.add(char);
//                 map.entities.add(prop);
//
//                 char.drawHP(app);
//                 prop.drawHP(app);
//
//                 map.addInteractiveEntity(char);
//                 map.addInteractiveEntity(prop);
//
//                 //Define the game loop update/render logic
//                 const update = (time) => {
//                     map.render(c);
//
//                     //Compares real elapsed time with desired logic/physics framerate to maintain consistency
//                     //accumulatedTime marks how many seconds have passed since the last logic update
//                     accumulatedTime += (time - lastTime)/1000;
//                     lastTime = time;
//
//                     while (accumulatedTime > delta) {
//                         const SCALE = getScale();
//                         c.setSize(
//                             window.innerWidth/SCALE,
//                             window.innerHeight/SCALE,
//                             SCALE
//                         );
//                         c.update(char, map, delta);
//                         map.update(delta);
//                         accumulatedTime -= delta;
//                     }
//                     gameLoop.current = requestAnimationFrame(update);
//                 }
//                 gameLoop.current = requestAnimationFrame(update);
//             });
//         });
//     }, []);
//
//     return (
//         <div className='nobar' />
//     )
// }

//Game loop & logic for multiplayer
export function OnlineGame(props) {
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
  const [baseSkeleton, setBaseSkeleton] = useState();

  const [camera, setCamera] = useState(new Camera());

  const { server, currentAccount } = useContext(ReferenceDataContext);

  let gameLoop = useRef();
  var spineData;

  const getScale = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;

    var scaler = h/14;
    scaler = Math.max(24, scaler)/64;

    return scaler;
  }

  const loadBaseSkeleton = fetch(rawAtlasData)
  .then(r => r.text())
  .then(text => {
    var spineAtlas = new TextureAtlas(text, function(line, callback) {
      // pass the image here.
      callback(PIXI.BaseTexture.from('/atlas/'+line));
    }); // specify path, image.png will be added automatically

    var spineAtlasLoader = new AtlasAttachmentLoader(spineAtlas)
    var spineJsonParser = new SkeletonJson(spineAtlasLoader);

    spineData = spineJsonParser.readSkeletonData(rawSkeletonData);

    return spineData;
  });

  const scanTrait = (uri, name) => {
    var result;
    for(let item of uri.attributes) {
      if (item['trait_type'].toString() == name.toString()) return item['value'];
    }
  }

  const genFounder = async (spine) => {
    const newSkin = new Skin("combined-skin");

    newSkin.addSkin(spine.spineData.findSkin("default"));

    const race = 15;
    const eyes = 9;
    const mouth = 0;
    const pants = 2;
    const handL = 1;
    const handR = 1;
    const hair = 10;

    newSkin.addSkin(spine.spineData.findSkin(`head/head-${race}`));
    newSkin.addSkin(spine.spineData.findSkin(`body/body-${race}`));

    newSkin.addSkin(spine.spineData.findSkin(`left-arm/left-arm-${race}-${handL}`));
    newSkin.addSkin(spine.spineData.findSkin(`right-arm/right-arm-${race}-${handR}`));

    newSkin.addSkin(spine.spineData.findSkin(`left-legs/left-legs-${race}`));
    newSkin.addSkin(spine.spineData.findSkin(`right-legs/right-legs-${race}`));

    newSkin.addSkin(spine.spineData.findSkin(`eyes/eyes-${race}-${eyes}`));
    newSkin.addSkin(spine.spineData.findSkin(`eyes/eyes-${race}-${eyes}`));

    newSkin.addSkin(spine.spineData.findSkin(`mouth/mouth-${race}-${mouth}`));

    newSkin.addSkin(spine.spineData.findSkin(`hair/hair-${hair}`));

    newSkin.addSkin(spine.spineData.findSkin(`left-pants/left-pants-${pants}`));
    newSkin.addSkin(spine.spineData.findSkin(`right-pants/right-pants-${pants}`));

    spine.skeleton.setSkin(newSkin);
    spine.skeleton.setSlotsToSetupPose();
  }

  const genSkin = async (spine, tokenID) => {
    const newSkin = new Skin("combined-skin");

    newSkin.addSkin(spine.spineData.findSkin("default"));

    const uriPath = require('./res/bh nft metadata/' + tokenID)

    await fetch(uriPath)
    .then(async(r) => await r.json())
    .then(traits => {
      var race = bhTraits.RACE.indexOf(scanTrait(traits,'Race'));

      newSkin.addSkin(spine.spineData.findSkin(`head/head-${race}`));
      newSkin.addSkin(spine.spineData.findSkin(`body/body-${race}`));

      var weaponL = Math.max(0,bhTraits.ITEMS.indexOf(scanTrait(traits,'Left Item')));
      var weaponR = Math.max(0,bhTraits.ITEMS.indexOf(scanTrait(traits,'Right Item')));
      newSkin.addSkin(spine.spineData.findSkin(`left-item/left-item-${weaponL}`));
      newSkin.addSkin(spine.spineData.findSkin(`right-item/right-item-${weaponR}`));

      var handL = Math.max(1,bhTraits.armAssign[weaponL]);
      var handR = Math.max(1,bhTraits.armAssign[weaponR]);
      newSkin.addSkin(spine.spineData.findSkin(`left-arm/left-arm-${race}-${handL}`));
      newSkin.addSkin(spine.spineData.findSkin(`right-arm/right-arm-${race}-${handR}`));


      newSkin.addSkin(spine.spineData.findSkin(`left-legs/left-legs-${race}`));
      newSkin.addSkin(spine.spineData.findSkin(`right-legs/right-legs-${race}`));

      var eyes = bhTraits.EYES.indexOf(scanTrait(traits,'Eyes'));
      eyes = Math.max(eyes,0);
      newSkin.addSkin(spine.spineData.findSkin(`eyes/eyes-${race}-${eyes}`));

      var mouth = bhTraits.MOUTHS.indexOf(scanTrait(traits,'Mouth'));
      newSkin.addSkin(spine.spineData.findSkin(`mouth/mouth-${race}-${mouth}`));

      var hair = bhTraits.HAIR.indexOf(scanTrait(traits,'Hair'));
      var hat = Math.max(0,bhTraits.HATS.indexOf(scanTrait(traits,'Hat')));
      if (bhTraits.HATLESSHAIR.indexOf(hair) < 0){
        hair = Math.max(hair,0);
        newSkin.addSkin(spine.spineData.findSkin(`hair/hair-${hair}`));
      }

      var glasses = Math.max(0,bhTraits.ACCESSORIES.indexOf(scanTrait(traits,'Eye Accessory')));
      newSkin.addSkin(spine.spineData.findSkin(`glasses/glasses-${race}-${glasses}`));

      //newSkin.addSkin(spine.spineData.findSkin(`bangs/bangs-${hair}`));
      newSkin.addSkin(spine.spineData.findSkin(`hat/hat-${race}-${hat}`));

      var pants = bhTraits.PANTS.indexOf(scanTrait(traits,'Bottoms'));
      pants = Math.max(pants,0);
      newSkin.addSkin(spine.spineData.findSkin(`left-pants/left-pants-${pants}`));
      newSkin.addSkin(spine.spineData.findSkin(`right-pants/right-pants-${pants}`));

      var shirt = bhTraits.SHIRTS.indexOf(scanTrait(traits,'Top'));
      shirt = Math.max(shirt,0);
      newSkin.addSkin(spine.spineData.findSkin(`shirt/shirt-${shirt}`));
      newSkin.addSkin(spine.spineData.findSkin(`right-sleeve/right-sleeve-${shirt}-1`));
      newSkin.addSkin(spine.spineData.findSkin(`left-sleeve/left-sleeve-${shirt}-1`));
    });

    spine.skeleton.setSkin(newSkin);
  }

  const initPlayerOnServer = (entity, serverState) => {
    const remotePlayer = serverState.initialData;
    if (remotePlayer){
      entity.pos.set(remotePlayer.pos.x, remotePlayer.pos.y);
      entity.facing = remotePlayer.facing;
    }

    const data = {
      hp: entity.hp,
      skeleton: props.tokenID,
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

  const checkForPlayers = (skeleton, container, char, level, socket, serverState) => {
    server.on('addPlayer', data => {
      if (!serverState.players[data.id]) {
        createChar(data.skeleton, data.id, socket, false, serverState).then((player) => {
          newPlayer(skeleton, container, level, player, data.skeleton);
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
      if (serverState.remoteData != {}) serverState.oldData = serverState.remoteData;
      serverState.remoteData = data;

      Object.entries(serverState.remoteData).forEach((item, index) => {
        if (index == 0) serverState.lastUpdate = item[1].timestamp;
        const key = item[0];
        const userData = item[1];
        //if (serverState.predictions[key] && serverState.predictions[key].pos) console.log(serverState.predictions[key].pos, userData.pos);
        //serverState.predictions[key] = {pos: {x: userData.pos.x, y: userData.pos.y}}
        if (!serverState.players[key]) {
          createChar(userData.skeleton, key, server, false, serverState).then((player) => {
            newPlayer(skeleton, container, level, player, serverState, userData.skeleton);
            player.pos.set(userData.pos.x, userData.pos.y);
            player.hp = userData.hp;
            player.facing = userData.facing;
            serverState.players[key] = player;
          });
        }
      })
    });
  }

  const newPlayer = async (BS, container, level, player, serverState, tokenID) => {
    const BH =  new Spine(BS);
    genSkin(BH, tokenID);

    //genFounder(BH);
    animationManager.bobbleheadMix(BH);

    player.skeleton = BH;

    container.addChild(player.container);
    player.draw();

    level.entities.add(player);
    level.addInteractiveEntity(player);
  }

  const beginPing = (stats, serverState) => {
    setInterval(() => {
      const start = Date.now();
      // volatile, so the packet will be discarded if the socket is not connected
      server.volatile.emit("ping", () => {
        const PING = Date.now() - start;
        serverState.ping = PING;
        stats.latency.text = 'PING: ' + PING + 'ms';
      });
    }, 1000);
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
    const BS = await loadBaseSkeleton;
    setBaseSkeleton(BS);

    await server.emit('getGameId', (id) => {
      serverState.gameId = id;
      server.emit('fetchData', (data) => {
        serverState.initialData = data;
        serverState.clientWallet = currentAccount.toLowerCase();

        const bgLayer = new PIXI.Container();
        const worldLayer = new PIXI.Container();
        const entityLayer = new PIXI.Container();

        const statsHud = new PerformanceOverlay(serverState.gameId);
        beginPing(statsHud, serverState);

        app.stage.addChild(bgLayer);
        app.stage.addChild(worldLayer);
        app.stage.addChild(entityLayer);
        app.stage.addChild(statsHud.container);

        const loadMap = assetManager.loadLevel(app, worldLayer, 1);
        const c = new Camera();

        document.body.appendChild(app.view);

        preLoader
          .add('bg0', 'res/backgrounds/1/0.png')
          .add('bg1', 'res/backgrounds/1/1.png')
          .add('bg2', 'res/backgrounds/1/2.png')
          .add('bg3', 'res/backgrounds/1/3.png')

        preLoader.load((loader, resources) => {
          const bh = new Spine(BS);
          //genSkin(bh, Math.floor(Math.random()*10000)+1);
          //const dummy = createSkeleton(app, resources);

          genSkin(bh, Math.floor(serverState.initialData.skeleton || props.tokenID));
          animationManager.bobbleheadMix(bh);
          //animationManager.bobbleheadMix(dummy);

          Promise.all([loadMap,createChar(0, currentAccount, server, serverState, true)])
          .then(([map, char]) => {

            map.bg[0] = map.createBg(resources['bg0'].texture, bgLayer);
            map.bg[1] = map.createBg(resources['bg1'].texture, bgLayer);
            map.bg[2] = map.createBg(resources['bg2'].texture, bgLayer);
            map.bg[3] = map.createBg(resources['bg3'].texture, bgLayer);

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

            let clock = 0;

            //Defines keybinds
            bindKeysServer(char,input,window, server);


            map.entities.add(char);
            //map.entities.add(prop);

            char.draw();
            //prop.drawHP(app);

            map.addInteractiveEntity(char);
            //map.addInteractiveEntity(prop);
            checkForPlayers(BS, entityLayer, char, map, server, serverState);

            //Define the game loop update/render logic
            const update = (time) => {
              map.render(c);
              statsHud.update((time - lastTime)/1000);

              //Compares real elapsed time with desired logic/physics framerate to maintain consistency
              //accumulatedTime marks how many seconds have passed since the last logic update
              accumulatedTime += (time - lastTime)/1000;
              lastTime = time;

              if (clock == 0 && serverState.lastUpdate != 0) {
                clock = serverState.lastUpdate;
              }

              while (accumulatedTime > delta) {
                if (clock != 0) clock += delta*1000;

                const SCALE = getScale();
                c.setSize(
                  window.innerWidth/SCALE,
                  window.innerHeight/SCALE,
                  SCALE
                );
                c.update(char, map, delta);
                map.update(delta, serverState, clock);
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
