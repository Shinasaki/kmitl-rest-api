'use strict';
const Hapi = require('hapi');
const HapiAuth = require('hapi-auth-jwt2');
const JWT = require('jsonwebtoken');
const bodyParser = require('body-parser');
// HTTP Request
const Request = require('request');
const axios = require("axios");


// MongoDB
var MongoClient = require('mongodb').MongoClient
var dbUrl = "mongodb://localhost:27017"
var ObjectId = require('mongodb').ObjectID;

// Hapi Validate
const validate = function (decoded, request, callback) {
    if (decoded) {
        MongoClient.connect(dbUrl, function (err, db) {
            const dbase = db.db('kmitl-restful');
            dbase.collection('users').find(ObjectId(decoded.id)).toArray(function(err, result) {
                if (typeof(result[0]) == 'undefined')  return callback(null, false); else return callback(null, true);
            })
        })
    } else return callback(null, false);
};


const server = new Hapi.Server();
server.connection({
  host: 'localhost',
  port: 5000
});
// server.connection({ routes: { cors: true } })


server.register(HapiAuth, err => {
    if (err) {
        return reply(err)
    };
    server.auth.strategy('jwt', 'jwt', {
        key: 'mysecretKey',
        validateFunc: validate,
    });
    server.auth.default('jwt');
})


// Login Route
server.route({
    method: 'POST',
    path: '/user/login',
    config: {
        auth: false
    },
    handler: (client_request, reply) => {
        
        // guards
        if (!client_request.payload) {
            reply('payload required!').code(400);
            return;
        };
        if (!client_request.payload.username) {
            reply('username required!').code(400);
            return;
        };
        if (!client_request.payload.password) {
            reply('password required!').code(400);
            return;
        };
        

        // login
        let requestData = { "username": client_request.payload.username, "password": client_request.payload.password };
        JSON.stringify(requestData);

        let options = {
            url: "https://grabkeys.net/KMITL/kmitl-auth-api/",
            method: 'POST',
            json: requestData,
            headers: { 'Content-type' : 'application/json' }
        };

        var test = Request(options, function (error, response, body) {
            if (!error && body.code == 200) {

                // new user -> add
                MongoClient.connect(dbUrl, function (err, db) {
                    if (err) throw reply(err).code(500);
                    const dbase = db.db('kmitl-restful');

                    // create object
                    var data = {
                        "username": requestData.username,
                        "permission": 0
                    }

                    // check user exist
                    dbase.collection('users').find({"username": data.username}).toArray(function(err, result) {
                        if (err) reply(err).code(202); else {
                            // new user --> add
                            if (typeof(result[0]) == 'undefined') dbase.collection('users').update({"username": requestData.username}, data, {upsert: true});
                            

                            // response token key
                            let objId = { id: result[0]._id.toString() }
                            let token = JWT.sign(objId, 'mysecretKey', { expiresIn: '1d' });
                            if (err) reply(err).code(202); else reply({ token: token }).code(200);
                        }
                    })
                })
            } else { reply(body.description).code(401); }
        });
    }
});

server.route({
    method: 'GET',
    path: '/user/get',
    handler: (client_request, reply) => {
        MongoClient.connect(dbUrl, function (err, db) {
            const dbase = db.db('kmitl-restful');
            dbase.collection('users').find(ObjectId(client_request.auth.credentials.id)).toArray(function(err, result) {
                if (typeof(result[0]) == 'undefined') reply(err).code(204); else reply(result).code(200)
            })
        })
    }
})


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

