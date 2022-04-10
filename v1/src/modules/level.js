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
        this.data = null;

        this.xCount = 1;
        this.yCount = 1;
        this.width = 0;
        this.height = 0;

        this.entityCollision = new EntityCollider(this.entities);
        this.tileCollision = new TileCollider(this.collisionData);
    }

    render(cam) {
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

    update(delta, serverState, clock) {
        if (!serverState.remoteData) return;

        const remoteDelta = (clock - serverState.lastUpdate);
        const nextUpdate = serverState.lastUpdate + 200;

        this.entities.forEach((entity) => {
            if(serverState.remoteData && serverState.remoteData[entity.id] && serverState.oldData && serverState.oldData[entity.id]){
                //Grab most up to date player data
                const remotePlayer = serverState.remoteData[entity.id];
                const remotePlayerOld = serverState.oldData[entity.id];
                //predict entity movement for a visibly smoother client, avoid jitters/snaps

                const lerpFactor = (clock-serverState.lastUpdate)/(200);

                //interpolate between the client position and the server position based on how much time has passed
                //distance = getDistance(entity.pos, remotePlayer.pos);

                entity.vel.set(remotePlayer.vel.x, remotePlayer.vel.y);

                entity.pos.x = lerp(remotePlayerOld.pos.x, remotePlayer.pos.x, lerpFactor);
                entity.pos.y = lerp(remotePlayerOld.pos.y, remotePlayer.pos.y, lerpFactor);

                entity.isGrounded = remotePlayer.grounded;
                entity.hurtTime = remotePlayer.hurtTime;
                entity.hitSource = remotePlayer.hitSource;

                //Make sure other players face the proper direction
                if (entity.id != serverState.clientWallet) {
                    entity.facing = remotePlayer.facing;
                }

                entity.update(delta, serverState);
                entity.pos.x += entity.vel.x*delta;
                this.tileCollision.checkX(entity);
                entity.vel.y += entity.vel.y*delta;
                this.tileCollision.checkY(entity);
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
