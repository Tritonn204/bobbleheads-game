import { Trait } from './entity.js';
import * as PIXI from "pixi.js";

const physics = require("./physics.js");

export class Velocity extends Trait {
    constructor() {
        super('velocity');
    }

    update() {

    }
}

export class Run extends Trait {
    constructor() {
        super('run');

        this.dir = 0;
        this.acc = 525;
        this.speed = 650;
        this.walkSpeed = 128;
    }

    update(entity, delta) {
        if (entity.ragdoll)
            return;
        if (entity.crouching)
            entity.vel.x *= (entity.isGrounded ? 0.6 : 0.72) / (1-delta);
        else if (entity.run.dir != 0){
            const fullSpd = entity.guard && entity.vel.y == 0 ? this.walkSpeed : this.speed;
            let accSpd = entity.vel.x + this.acc * delta * entity.run.dir;

            if ((entity.run.dir > 0 && accSpd < 0) || (entity.run.dir < 0 && accSpd > 0))
                accSpd = entity.vel.x * (entity.isGrounded ? 0.6 : 0.85) / (1-delta);
            if (accSpd > fullSpd)
                accSpd = fullSpd;
            if (accSpd < -fullSpd)
                accSpd = -fullSpd;

            entity.vel.x = accSpd;
        } else {
            entity.vel.x *= (entity.isGrounded ? 0.6 : 0.925) / (1-delta);
        }
    }
}

export class HPBar extends Trait {
    constructor() {
        super('hpBar')
        this.hpBorder = PIXI.Sprite.from(PIXI.Texture.WHITE);
        this.hpBar = PIXI.Sprite.from(PIXI.Texture.WHITE);
        this.hpFill = PIXI.Sprite.from(PIXI.Texture.WHITE);
    }
    render(entity, cam) {
        this.hpBorder.position.set(
            (entity.pos.x + entity.width/2 - cam.pos.x - 52)*cam.scale,
            (entity.pos.y - cam.pos.y - 77)*cam.scale);
        this.hpBorder.width = 104*cam.scale;
        this.hpBorder.height = 14*cam.scale;
        this.hpBorder.tint = 0x000000;

        this.hpBar.position.set(
            (entity.pos.x + entity.width/2 - cam.pos.x - 50)*cam.scale,
            (entity.pos.y - cam.pos.y - 75)*cam.scale);
        this.hpBar.width = 100*cam.scale;
        this.hpBar.height = 10*cam.scale;
        this.hpBar.tint = 0xFF0000;

        this.hpFill.position.set(
            (entity.pos.x + entity.width/2 - cam.pos.x - 50)*cam.scale,
            (entity.pos.y - cam.pos.y - 75)*cam.scale);
        this.hpFill.width = 100*(entity.hp/entity.baseHP)*cam.scale;
        this.hpFill.height = 10*cam.scale;
        this.hpFill.tint = 0x048F3E;
    }

    update() {

    }
}

export class Punch extends Trait {
    constructor(socket) {
        super('punch');

        this.duration = 0.5;
        this.comboPeriod = 0.3;
        this.engageTime = 0;

        this.delay = 0.1;
        this.punchPenalty = 0.5;
        this.hitWindow = 0.1;

        this.inset = 16;
        this.width = 140;
        this.height = 100;

        this.bounds = new physics.BoundingBox();

        this.cooldownDuration = 1.5;
        this.cooldownTimer = 0;

        this.animationNames = ["Punch A", "Punch B", "Punch C"];
        this.queued = false;

        this.index = 0;

        this.active = false;
    }

    advance() {
        if (this.cooldownTimer < this.cooldownDuration && this.index == 1)
            return;
        if (!this.active)
            this.start();
        else if (this.index < 2){
            if (this.engageTime < this.comboPeriod){
                this.engageTime = this.duration;
                this.index++;
                this.queued = true;

                this.cooldownTimer -= this.punchPenalty;
                this.cooldownTimer = Math.max(this.cooldownTimer, 0);
            }
            if (this.index == 2) {
                this.cooldownTimer = 0;
            }
        }
    }

    start() {
        this.engageTime = this.duration;
        this.active = true;
        this.queued = true;
    }

    cancel() {
        this.engageTime = 0;
    }

    hitbox(entity) {
        if (this.engageTime < this.duration - this.delay && this.engageTime > this.duration - this.delay - this.hitWindow){
            entity.attackBounds.pos.set(entity.pos.x, entity.pos.y);
            entity.attackBounds.size.set(this.width, this.height);
            entity.attackBounds.offset.set((entity.width-this.inset)*entity.facing, 0);
        } else {
            entity.attackBounds.pos.set(-1000,0);
        }
    }

    update(entity, delta) {
        if (this.engageTime > 0) {
            this.hitbox(entity);
            this.engageTime -= delta;
        } else {
            this.active = false;
            this.index = 0;
        }
        this.cooldownTimer += delta;
    }
}

export class Jump extends Trait {
    constructor() {
        super('jump');

        this.duration = 0.25;
        this.velocity = 580;
        this.engageTime = 0;
    }

    start() {
        this.engageTime = this.duration;
    }

    cancel() {
        this.engageTime = 0;
    }

    update(entity, delta) {
        if (this.engageTime > 0) {
            entity.vel.y = -this.velocity;
            this.engageTime -= delta;
        }
    }
}
