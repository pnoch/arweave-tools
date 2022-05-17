const axios = require('axios');
const { exec } = require('child_process');
const isPortReachable = require('is-port-reachable');

console.log();
console.log('+---------------------------+');
console.log('| ARWEAVE PEERS LISTER V1.0 |');
console.log('| Francesco Adamo  06/24/21 |');
console.log('+---------------------------+');
console.log();

// CHANGELOG
// 06/24/21 V1.0: initial public release

axios.interceptors.request.use(function (config) {
      config.metadata = { startTime: new Date()}
      return config;
}, function (error) {
      return Promise.reject(error);
});

axios.interceptors.response.use(function (response) {
      response.config.metadata.endTime = new Date()
      response.duration = response.config.metadata.endTime - response.config.metadata.startTime
      return response;
}, function (error) {
      error.config.metadata.endTime = new Date();
      error.duration = error.config.metadata.endTime - error.config.metadata.startTime;
      return Promise.reject(error);
});

const { program } = require('commander');
program.option('-n, --number <num>', 'number of peers to use, ordered by fastest', 50);
program.parse(process.argv);
const options = program.opts();

const numPeers = options.number;

start(); // run
async function start() {
    try {
        // ARWEAVE NETWORK
        process.stdout.write('getting peers...');
        const networkResponse = await axios.get('http://arweave.net/peers');
        const peers = networkResponse.data;
        // console.log(peers);
        console.log(' DONE!');

		// PEERS PORT
        process.stdout.write('testing if peers port is open...');
        const peers_port_ok = ["188.166.200.45:1984", "188.166.192.169:1984", "163.47.11.64:1984", "139.59.51.59:1984", "138.197.232.192:1984"];
        for (let k = 0; k < peers.length; k++) {
            if (peers[k].startsWith('127.0.0')) continue;             
            const portStatus= await isPortReachable(1984, {host: peers[k].split(':')[0]})
            if (portStatus) peers_port_ok.push(peers[k]);
        }
        console.log(' DONE!');
        
        // PEERS BLOCK CHECK
        process.stdout.write('testing if peers have synced to height...');
        const peers_height_query = [];
        for (let k = 0; k < peers_port_ok.length; k++) {
            peers_height_query.push(axios.get('http://' + peers_port_ok[k] + '/block/height/930000').catch(function(err){return err}))
        }
        const peer_height_responses = await Promise.all(peers_height_query);
        console.log(' DONE!');

        // SORT BY FASTEST
        process.stdout.write('sorting peers response time...');
        console.log();
        const list = [];
        for (let k = 0; k < peer_height_responses.length; k++) {
            const time = peer_height_responses[k].status == 200 ? peer_height_responses[k].duration : Infinity;
            console.log(peers[k] + ' ms: ' + time);
            list.push([peers[k], time]);
        }
        list.sort((a, b) => a[1] - b[1]);
        console.log(' DONE!');

        // GENERATE STRING
        console.log();
        let connectString = '';
        for (let k = 0; k < numPeers; k++) {
            connectString += 'peer ' + list[k][0] + ' ';
        }
        console.log(connectString);
    } 
    catch (err) {
        console.log('there was an error!');
        console.log(err.toString().slice(0, 200));
        console.log('terminating...');
    }
    console.log();
}

function execPromise(command) {
    return new Promise(resolve => {
        const program = exec(command);
        let output = '';
        program.stdout.on('data', (data) => {
            output += data;
        });
        program.on('exit', (code) => {
            resolve(output);
        });
    });
}
