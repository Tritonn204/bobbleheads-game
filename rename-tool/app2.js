var fs = require('fs');

const dir = '../v1/public/res/avatars/Game Ready/Bobbleheads.json';
const dest = '../pieces/';
const prefix = 'left-sleeve-';

const races = 16;
const shirts = 17;

const counts =
{
    bangs: [11],
    hair: [11],
    hairback: [11],
    head: [races],
    body: [races],
    'left-legs': [races],
    'right-legs': [races],
    'left-pants': [8],
    'right-pants': [8],
    'left-arm': [races, 3],
    'right-arm': [races, 3],
    shirt: [shirts],
    'left-sleeve': [shirts, 3],
    'right-sleeve': [shirts, 3],
    neck: [9],
    mouth: [races, 14],
    glasses: [races, 11],
    eyes: [races, 10],
    hat: [races, 19],
    earrings: [races, 12],
    'left-item': [27],
    'right-item': [27]
}

const newSkins = [];

fs.readFile(dir, (err, content) => {
    var data = JSON.parse(content);

    newSkins.push(data.skins[0]);

    Object.keys(data.skins[0].attachments).forEach(key => {
        Object.keys(data.skins[0].attachments[key]).forEach((attachment, i) => {
            if (attachment in counts){
                for(let i = 0; i < counts[attachment][0]; i++){
                    if (counts[attachment].length == 2) {
                        for(let j = 0; j < counts[attachment][1]; j++){
                            const result = `${attachment}-${i}-${j}`;

                            const newAttachment = {
                                name: `${attachment}/${result}`,
                                attachments: {
                                    [key]: {
                                        [attachment]: Object.assign({},data.skins[0].attachments[key][attachment])
                                    }
                                }
                            };

                            newAttachment.attachments[key][attachment].name = `${result}`;

                            newSkins.push(newAttachment);
                        }
                    } else {
                        const result = `${attachment}-${i}`;

                        const newAttachment = {
                            name: `${attachment}/${result}`,
                            attachments: {
                                [key]: {
                                    [attachment]: Object.assign({},data.skins[0].attachments[key][attachment])
                                }
                            }
                        };

                        newAttachment.attachments[key][attachment].name = `${result}`;

                        newSkins.push(newAttachment);
                    }
                }
                delete data.skins[0].attachments[key];
            } else {
                data.skins[0].attachments[key][attachment].name = attachment;
            }
        });
    });


    Object.assign(data.skins, newSkins);

    Object.keys(data.animations).forEach(anim => {
        Object.keys(data.animations[anim]).forEach(term => {
            if (term == 'deform') {
                Object.keys(data.animations[anim]['deform']['default']).forEach(key => {
                    Object.keys(data.animations[anim]['deform']['default'][key]).forEach((attachment, i) => {
                        if (attachment in counts){
                            for(let i = 0; i < counts[attachment][1]; i++){
                                if (counts[attachment].length == 2) {
                                    for(let j = 0; j < counts[attachment][0]; j++){
                                        const result = `${attachment}/${attachment}-${i}-${j}`;
                                        Object.assign(data.animations[anim]['deform'], {
                                            [result]: {
                                                [key]: {
                                                    [attachment]: Object.assign({},data.animations[anim]['deform']['default'][key][attachment])
                                                }
                                            }
                                        })
                                    }
                                } else {
                                    const result = `${attachment}/${attachment}-${i}`;
                                    Object.assign(data.animations[anim]['deform'], {
                                        [result]: {
                                            [key]: {
                                                [attachment]: Object.assign({},data.animations[anim]['deform']['default'][key][attachment])
                                            }
                                        }
                                    })
                                }
                            }
                        }
                    });
                });
                data.animations[anim]['deform']['default'] = {};
            }
        });
    })

    fs.writeFile("NewSkeleton.json", JSON.stringify(data, null, "\t"), (err) => {
        if (err)
            console.log(err);
        else {
            console.log("File written successfully\n");
        }
    });
});
