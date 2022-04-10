import { Vec2 } from './util.js';
import * as PIXI from "pixi.js";

const physics = require('./physics.js');

export class Trait {
    constructor(name) {
        this.NAME = name;
    }

    update() {
        console.warn('Unhandled update call in Trait');
    }
}

export class Entity {
    constructor(width=0, height=0) {
        this.pos = new Vec2(0,0);
        this.predictedPos = new Vec2(0,0);
        this.spawnPoint = new Vec2(0,0);
        this.vel = new Vec2(0,0);
        this.container = new PIXI.Container();

        this.bounds = new physics.BoundingBox(this.pos, new Vec2(width, height), new Vec2(0,0));
        this.attackBounds = new physics.BoundingBox(new Vec2(-width,-height), new Vec2(width*1.25, height), new Vec2(width*1.25,0));

        this.hitBox = PIXI.Sprite.from(PIXI.Texture.WHITE);

        this.width = width;
        this.height = height;

        this.skelWidth = width;
        this.skelHeight = height;

        this.baseHP = 1000;
        this.hp = this.baseHP;

        this.hurtTime = 0;

        this.turnTime = 0.05;

        this.skelDir = 1;
        this.facing = 1;
        this.hitSource = 1;

        this.guard = false;
        this.ragdoll = false;

        this.flipX = false;
        this.crouching = false;

        this.traits = [];
        this.isGrounded = false;

        this.skeleton = null;
        this.currentAnimation = '';
    }

    addTrait(trait) {
        this.traits.push(trait);
        this[trait.NAME] = trait;
    }

    update(delta, serverState) {
        if (this.isGrounded && this.vel.y == 0)
            this.ragdoll = false;

        this.bounds.pos = this.pos;
        this.hurtTime += delta;

        this.attackBounds.pos.set(-1000,0);
        this.traits.forEach(trait => {
            trait.update(this, delta);
        });

        if(serverState.remoteData && serverState.remoteData[this.id]){
            this.hp = serverState.remoteData[this.id].hp;
        }

        this.animate(delta);
        this.getDirection(delta);
        this.hp = Math.max(this.hp,0);
    }

    collides(cantidate) {

    }

    destroy() {
        this.container.destroy(true);
    }

    hit(cantidate) {
        if (this.punch){
            const dir = cantidate.pos.x > this.pos.x ? 1 : -1;
            this.hitSource = dir;
            if (this.punch.index == 2) {
                this.ragdoll = true;
                this.isGrounded = false;
                this.vel.x = this.getImpactVelocity()*dir/2;
                this.vel.y = -500;
            }
        }
    }

    hurt(cantidate) {
        if (this.hurtTime >= physics.hitCooldown){
            if (cantidate.punch){
                this.hp -= 10;
                const dir = cantidate.pos.x < this.pos.x ? 1 : -1;
                this.hitSource = dir;
                if (cantidate.punch.index == 2) {
                    this.hp -= 50;
                    this.ragdoll = true;
                    this.isGrounded = false;
                    this.vel.x = this.getImpactVelocity()*cantidate.facing;
                    this.vel.y = -800;
                    console.log("Took hit from", cantidate);
                } else {
                    this.ragdoll = true;
                    this.isGrounded = false;
                    this.vel.x = cantidate.facing*this.getImpactVelocity()/2;
                    this.vel.y = -250;
                }
            }
            this.hurtTime = 0;
        }
    }

    draw() {

    }

    getImpactVelocity() {
        return 500;
    }

    getDirection(delta) {
        if (this.run && this.run.dir < 0){
            this.facing = -1;
        }
        if (this.run && this.run.dir > 0){
            this.facing = 1;
        }
        if (this.facing < 0)
            if (this.skelDir > -1){
                this.skelDir -= delta/ this.turnTime;
            }

        if (this.facing > 0)
            if (this.skelDir < 1){
                this.skelDir += delta/ this.turnTime;
            }
        this.skelDir = Math.min(Math.max(this.skelDir, -1), 1);
    }
}
