const physics = require('./physics.js');

//Javascript key codes
const SPACE = 32;
const W = 87;
const A = 65;
const S = 83;
const D = 68;

const Q = 81;

const RIGHT = 39;
const LEFT = 37;
const DOWN = 40;
const UP = 38;

export function bindKeys(player, keyboard, window) {
    keyboard.addMapping(W, keyState => {
        if (keyState) {
            player.jump.start();
            player.isGrounded = false;
        } else {
            player.jump.cancel();
        }
    });

    keyboard.addMapping(SPACE, keyState => {
        if (keyState) {
            player.pos.set(player.spawnPoint.x,player.spawnPoint.y);
            player.vel.set(0,0);
        }
    });

    keyboard.addMapping(S, keyState => {
        if (keyState == 1) {
            player.crouching = true;
        } else {
            player.crouching = false;
        }
    });

    keyboard.addMapping(RIGHT, keyState => {
        if (keyState) {
            player.punch.advance();
        }
    });

    keyboard.addMapping(DOWN, keyState => {
        if (keyState == 1) {
            player.guard = true;
        } else {
            player.guard = false;
        }
    });

    keyboard.addMapping(D, keyState => {
        player.run.dir += keyState ? 1 : -1;
    });

    keyboard.addMapping(A, keyState => {
        player.run.dir += keyState ? -1 : 1;
    });

    keyboard.listenTo(window);
}

export function bindKeysServer(player, keyboard, window, socket) {
    keyboard.addMapping(UP, keyState => {
        socket.emit('jump', keyState);
        // if (keyState && player.isGrounded && player.vel.y < physics.jumpTolerance) {
        //     player.jump.start();
        //     player.isGrounded = false;
        // } else {
        //     player.jump.cancel();
        // }
    });

    keyboard.addMapping(Q, keyState => {
        if (keyState) {
            player.pos.set(player.spawnPoint.x,player.spawnPoint.y);
            player.vel.set(0,0);
        }
        socket.emit('respawn', keyState);
    });

    keyboard.addMapping(DOWN, keyState => {
        if (keyState == keyboard.STATES.PRESSED) {
            player.crouching = true;
        } else {
            player.crouching = false;
        }
        socket.emit('crouch', keyState);
    });

    keyboard.addMapping(D, keyState => {
        if (keyState) {
            if (player.run.dir != 0) {
                player.dashAttack.start(player.run.dir);
                socket.emit('dashAttack', keyState);
            } else if (keyboard.keyStates.get(UP) == keyboard.STATES.PRESSED) {
                player.risingAttack.start();
                socket.emit('risingAttack', keyState);
            } else if (keyboard.keyStates.get(DOWN) == keyboard.STATES.PRESSED) {
                player.fallingAttack.start();
                socket.emit('fallingAttack', keyState);
            } else {
                player.punch.advance();
                socket.emit('punch', keyState);
            }
        }
    });

    keyboard.addMapping(S, keyState => {
        if (keyState == keyboard.STATES.PRESSED) {
            player.guard = true;
        } else {
            player.guard = false;
        }
        socket.emit('guard', keyState);
    });

    keyboard.addMapping(RIGHT, keyState => {
        player.run.dir += keyState ? 1 : -1;
        socket.emit('move right', keyState);
    });

    keyboard.addMapping(LEFT, keyState => {
        player.run.dir += keyState ? -1 : 1;
        socket.emit('move left', keyState);
    });

    keyboard.listenTo(window);
}
