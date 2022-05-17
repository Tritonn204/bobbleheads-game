import Compositor from '../Compositor.js';
import { Matrix, getDistance, calcSpeed, lerp } from './util.js';
import { TileCollider, EntityCollider } from './physics.js';
import * as PIXI from "pixi.js";

const physics = require('./physics.js');
const tileUtil = require('./tileutil.js');

export class Level {
    constructor() {
        this.comp = new Compositor();
        this.entities = new Set();
        this.bgTiles = new Matrix();
        this.tiles = new Matrix()
        this.collisionData = new Matrix();
        this.tileSet = null;
        this.data = null;
        this.tileTextures = [];
        this.bg = [];

        this.xCount = 1;
        this.yCount = 1;
        this.width = 0;
        this.height = 0;

        this.entityCollision = new EntityCollider(this.entities);
        this.tileCollision = new TileCollider(this.collisionData);
    }

    render(cam) {
        const bgSteps = this.bg.length + 1;
        const bgScale = (cam.scale*64)/(3930/14);
        this.bg.forEach((layer, i) => {
          layer.tilePosition.x = ((-cam.pos.x/bgScale)*cam.scale)/(bgSteps-i);
          layer.scale.x = bgScale;
          layer.scale.y = bgScale;
          layer.width=(window.innerWidth/bgScale);
        });

        this.data.layers.forEach(layer => {
            if (!layer.name.includes('collision')){
                layer.positions.forEach(tile => {
                    const x = tile.x;
                    const y = tile.y;
                    const renderTile = tileUtil.drawTile(tile.id, this.tileSet, cam, x, y, cam.scale);
                    if (renderTile){
                        const { sX, sY, sW, sH } = renderTile;
                        if (sX < -this.tileSet.width*cam.scale
                            || sY < -this.tileSet.height*cam.scale
                            || sX > cam.width*cam.scale
                            || sY > cam.height*cam.scale
                        ) {
                                if (this.bgTiles.get(x,y))
                                    this.bgTiles.get(x,y).visible = false;
                                if (this.tiles.get(x,y))
                                    this.tiles.get(x,y).visible = false;
                        } else {
                            if (this.bgTiles.get(x,y)){
                                this.bgTiles.get(x,y).visible = true;
                                this.bgTiles.get(x,y).position.set(sX, sY);
                                this.bgTiles.get(x,y).width = sW;
                                this.bgTiles.get(x,y).height = sH;
                            }
                            if (this.tiles.get(x,y)){
                                if (this.tiles.get(x,y)){
                                    this.tiles.get(x,y).visible = true;
                                    this.tiles.get(x,y).position.set(sX, sY);
                                    this.tiles.get(x,y).width = sW;
                                    this.tiles.get(x,y).height = sH;
                                }
                            }
                        }
                    }
                })
            }
        });

        this.entities.forEach(entity => {
            entity.render(cam, this.skeleton);
        })
    }

    addInteractiveEntity(entity) {
        this.entityCollision.entities.add(entity);
    }

    createBg(texture, container) {
      let tiling = new PIXI.TilingSprite(texture,texture.width,texture.height);
      tiling.position.set(0,0);
      container.addChild(tiling);

      return tiling;
    }

    update(delta, serverState, clock) {
        if (!serverState.remoteData) return;

        const nextUpdate = serverState.lastUpdate + 40 + serverState.ping/2;
        const remoteDelta = (clock - nextUpdate);

        this.entities.forEach((entity) => {
            if(serverState.remoteData && serverState.remoteData[entity.id] && serverState.oldData && serverState.oldData[entity.id]){
                //Grab most up to date player data
                const remotePlayer = serverState.remoteData[entity.id];
                const remotePlayerOld = serverState.oldData[entity.id];

                var lerpFactor = (clock-serverState.lastUpdate)/(40 + serverState.ping/2)

                //Decide between interpolation and extrapolation based on latency conditions
                if (lerpFactor > 2) {
                    entity.update(delta, serverState);

                    entity.vel.y += physics.gravity*delta;
                    entity.vel.y = Math.min(physics.terminalVelocity, entity.vel.y);

                    entity.pos.x += entity.vel.x*delta;
                    this.tileCollision.checkX(entity);

                    entity.pos.y += entity.vel.y*delta;
                    this.tileCollision.checkY(entity);
                } else {
                    //lerpFactor = Math.min(1, lerpFactor);

                    const dest = {
                        x:lerp(remotePlayerOld.pos.x, remotePlayer.pos.x, lerpFactor),
                        y:lerp(remotePlayerOld.pos.y, remotePlayer.pos.y, lerpFactor)
                    }
                    const newVel = {
                        x:lerp(remotePlayerOld.vel.x, remotePlayer.vel.x, lerpFactor),
                        y:lerp(remotePlayerOld.vel.y, remotePlayer.vel.y, lerpFactor)
                    }

                    entity.update(delta, serverState);

                    //lerpFactor = Math.min(1,((clock - serverState.lastUpdate)/(40 + serverState.ping/2))*0.175);
                    entity.pos.set(dest.x, dest.y);
                    entity.vel.lerp(newVel, 1);

                    entity.isGrounded = remotePlayer.grounded;
                    entity.hurtTime = remotePlayer.hurtTime;
                    entity.hitSource = remotePlayer.hitSource;

                    //Make sure other players face the proper direction
                    if (entity.id != serverState.clientWallet) {
                        entity.facing = remotePlayer.facing;
                    }
                }

                //TO BE UNCOMMENTED UPON ROLLBACK IMPLEMENTATION
                //entity.vel.y += physics.gravity*delta;

                //entity.pos.x += entity.vel.x*delta;
                //entity.pos.y += entity.vel.y*delta;
            }
        });
    }

    loadTileData(container) {
        this.data.layers.forEach(layer => {
            if (!layer.name.includes('collision')){
                layer.positions.forEach(tile => {
                    const x = tile.x;
                    const y = tile.y;
                    if (this.tiles.get(x,y)){
                        this.bgTiles.set(x,y,this.tiles.get(x,y));
                    }
                    this.tiles.set(x,y,new PIXI.Sprite(this.tileSet.getTileTexture(tile.id,4,this.tileTextures)));
                });
            }
            this.bgTiles.grid.map((column, x) => {
                column.map((tile, y) => {
                    tile.position.set(-this.tileSet.width,0);
                    container.addChild(tile);
                });
            })
            this.tiles.grid.map((column, x) => {
                column.map((tile, y) => {
                    tile.position.set(-this.tileSet.width,0);
                    container.addChild(tile);
                });
            })
        });
    }

    loadCollisionData() {
        this.data.layers.forEach(layer => {
            if (layer.name.includes('collision')){
                layer.positions.forEach(tile => {
                    this.collisionData.set(tile.x, tile.y,parseInt(layer.name.split("_").pop()));
                });
            }
        });
    }

    loadTextureData() {
        this.data.layers.forEach(layer => {
            if (!layer.name.includes('collision')){
                layer.positions.forEach(tile => {
                    if (!this.tileTextures[tile.id]) {
                        this.tileTextures[tile.id] = tileUtil.tileBuffer(tile.id, this);
                    }
                });
            }
        });
    }
}
