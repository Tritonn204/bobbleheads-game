var fs = require('fs');

const dir = '../pieces/Hairback/';
const dest = '../pieces/';
const prefix = 'hairback-';

fs.readdir(dir, (err, files) => {
  for (let i = 0; i < files.length; i++) {
      fs.readdir((dir + i + '/'), (err, files2) => {
          for (let j = 0; j < files2.length; j++) {
              fs.rename(`${dir}/${i}/${j}.png`, `${dest}/${prefix}${i}-${j}.png`, function(err) {
                  if ( err ){ console.log('ERROR: ' + err) } else {
                      console.log(`moved ${dir}/${i}/${j}.png to ${dest}/${prefix}${i}-${j}.png`)
                  }
              });
          }
      })
  }
});
