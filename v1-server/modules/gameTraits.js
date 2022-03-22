const { Trait } = require('./entity.js');
const physics = require("./physics.js");

class Velocity extends Trait {
    constructor() {
        super('velocity');
    }

    update() {

    }
}

class Run extends Trait {
    constructor() {
        super('run');

        this.dir = 0;
        this.acc = 450;
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

class Punch extends Trait {
    constructor(socket) {
        super('punch');

        this.duration = 0.5;
        this.comboPeriod = 0.3;
        this.engageTime = 0;

        this.delay = 0.1;
        this.hitWindow = 0.15;

        this.inset = 16;
        this.width = 120;
        this.height = 100;

        this.bounds = new physics.BoundingBox();

        this.cooldownDuration = 1.2;
        this.cooldownTimer = 0;

        this.animationNames = ["Punch A", "Punch B", "Punch C"];
        this.queued = false;

        this.index = 0;

        this.active = false;
    }

    advance() {
        if (this.cooldownTimer < this.cooldownDuration)
            return;
        if (!this.active)
            this.start();
        else if (this.index < 2){
            if (this.engageTime < this.comboPeriod){
                this.engageTime = this.duration;
                this.index++;
                this.queued = true;

                this.cooldownTimer -= 0.4
                this.cooldownTimer = Math.max(this.cooldownTimer, 0);
            }
            if (this.index == 2)
                this.cooldownTimer = 0;
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
        if (this.active == false)
            this.cooldownTimer += delta;
    }
}

class Jump extends Trait {
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

module.exports = { Velocity, Jump, Run, Punch };
