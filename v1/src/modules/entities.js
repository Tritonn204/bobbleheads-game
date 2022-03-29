import { Entity } from './entity.js';
import { Velocity, Jump, Run, Punch, HPBar } from './gameTraits.js';
import { Spine } from 'pixi-spine';
import { loadPlayer } from './assets.js';

const tileUtil = require("./tileutil.js");
const physics = require("./physics.js");

//Create a fighter entity, load it's visual assets, and initialize it's global physics properties
export function createChar(index, id, socket, isClient, serverState) {
    return loadPlayer(index)
    .then(sprites => {
        const char = new Entity(63,109);

        char.skelWidth=180;
        char.skelHeight=180;
        char.flipX = true;
        char.id = id;

        char.spawnPoint.set(640, 0);
        char.pos.set(char.spawnPoint.x, char.spawnPoint.y);

        char.addTrait(new Velocity());
        char.addTrait(new Jump());
        char.addTrait(new Run());
        char.addTrait(new Punch());
        char.addTrait(new HPBar());

        char.render = (cam) => {
            char.hpBar.render(char, cam);
            return tileUtil.drawSpine(char, 'Idle Left', cam, char.pos.x, char.pos.y);
        }

        char.draw = () => {
            char.container.addChild(char.skeleton);
            char.container.addChild(char.hpBar.hpBorder);
            char.container.addChild(char.hpBar.hpBar);
            char.container.addChild(char.hpBar.hpFill);
        }

        char.animate = () => {
            if (isClient) {
                const movementX = Math.abs(char.vel.x);
                const playing = char.currentAnimation;
                const running = char.run.speed*0.99;

                if (char.hurtTime < physics.hitCooldown ){
                    let anim = (char.hitSource == char.facing ? "Hurt B" : "Hurt A");
                    anim = char.guard && char.hitSource != char.facing ? "Hurt Guard" : anim;

                    if (playing != anim){
                        char.skeleton.state.setAnimation(0, anim, false);
                        char.currentAnimation = anim;
                        socket.emit('animation', {
                            name: anim,
                            loop: false
                        });
                    }
                    return;
                }
                if (char.punch) {
                    if (char.punch.active) {
                        if (char.punch.queued){
                            char.punch.queued = false;
                            const anim = char.punch.animationNames[char.punch.index];
                            if (playing != anim){
                                char.skeleton.state.setAnimation(0,anim,false);
                                char.currentAnimation = anim;
                                socket.emit('animation', {
                                    name: anim,
                                    loop: false
                                });
                            }
                        }
                        return;
                    }
                }
                if (char.guard && Math.abs(char.vel.x) <= 10) {
                    if (playing != "Guard"){
                        char.skeleton.state.setAnimation(0,"Guard",false);
                        char.currentAnimation = "Guard";
                        socket.emit('animation', {
                            name: "Guard",
                            loop: false
                        });
                    }
                }else if (char.isGrounded && char.vel.y == 0){
                    if (char.crouching){
                        if (playing != "Crouch"){
                            char.skeleton.state.setAnimation(0,"Crouch",true);
                            char.currentAnimation = "Crouch";
                            socket.emit('animation', {
                                name: "Crouch",
                                loop: true
                            });
                        }
                    } else {
                        if (movementX <= 10 && playing != "Idle"){
                            char.skeleton.state.setAnimation(0,"Idle",true);
                            char.currentAnimation = "Idle";
                            socket.emit('animation', {
                                name: "Idle",
                                loop: true
                            });
                        }
                        else if(char.run){
                            if (char.guard){
                                if (movementX > 10 && playing != "Walk Guard"){
                                    char.skeleton.state.setAnimation(0,"Walk Guard",true);
                                    char.currentAnimation = "Walk Guard";
                                    socket.emit('animation', {
                                        name: "Walk Guard",
                                        loop: true
                                    });
                                }
                            }
                            else if (movementX > 10 && movementX < running && playing != "Walk"){
                                char.skeleton.state.setAnimation(0,"Walk",true);
                                char.currentAnimation = "Walk";
                                socket.emit('animation', {
                                    name: "Walk",
                                    loop: true
                                });
                            }
                            else if (movementX >= running && playing != "Run"){
                                char.skeleton.state.setAnimation(0,"Run",true);
                                char.currentAnimation = "Run";
                                socket.emit('animation', {
                                    name: "Run",
                                    loop: true
                                });
                            }
                        }
                    }
                } else {
                    if (playing != "Jump"){
                        char.skeleton.state.setAnimation(0,"Jump",false);
                        char.currentAnimation = "Jump";
                        socket.emit('animation', {
                            name: "Jump",
                            loop: false
                        });
                    }
                }
            } else if (serverState.remoteData[char.id]) {
                const animation = serverState.remoteData[char.id].animation;
                if (char.currentAnimation != animation.name) {
                    char.skeleton.state.setAnimation(0,animation.name,animation.loop);
                    char.currentAnimation = animation.name;
                }
            }
        }

        return char;
    });
}
