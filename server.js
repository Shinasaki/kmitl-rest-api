'use strict';
const Hapi = require('hapi');
const server = new Hapi.Server();
const HapiAuth = require('hapi-auth-jwt2');
const JWT = require('jsonwebtoken');


// MongoDB
var MongoClient = require('mongodb').MongoClient
var dbUrl = "mongodb://localhost:27017"
var ObjectID = require('mongodb').ObjectID


let user = {
    id: 1,
    name: 'Vasin Sermsampan'
};


server.connection({
  host: 'localhost',
  port: 5000
});


server.register(HapiAuth, err => {
    if (err) {
        return reply(err)
    };

    server.auth.strategy('jwt', 'jwt', {
        key: 'mysecretKey',
        validateFunc: validate
    });

    server.auth.default('jwt');
})




server.route({
    method: 'POST',
    path: '/user/login',
    config: {
        auth: false
    },
    handler: (request, reply) => {
        
        // guards
        if (!request.payload) {
            reply('payload required!').code(400);
            return;
        }
        if (!request.payload.username) {
            reply('username required!').code(400);
            return;
        }
        if (!request.payload.password) {
            reply('password required!').code(400)
            return;
        }
        

        
        // // find user
        // MongoClient.connect(dbUrl, function (err, db) {
        //     if (err) throw reply(err).code(500)
        //     const dbase = db.db('kmitl-restful')


        // })


    }
});





server.route({
  method: 'GET',
  path: '/',
  config: {
      auth: false
  },
  handler: (request, reply) => {
    
    let token = JWT.sign(user, 'mysecretKey', {
        expiresIn: '7d'
    });

    reply({
        token: token
    });
  }
});

server.route({
  method: 'GET',
  path: '/me',
  handler: (request, reply) => {
    reply(request.auth.credentials);
  }
});

server.start(() => {
  console.log("Server is running");
});



function validate(decoded, request, callback) {
    if (decoded.name === 'Vasin Sermsampan') {
        return callback(null, true);
    } else {
        return callback(null, false);
    }
}




