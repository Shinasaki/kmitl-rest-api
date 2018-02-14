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
  port: 5000,
  routes: { cors: true }
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

        Request(options, function (error, response, body) {
            if (!error && body.code == 200) {

                // CONNECT DB
                MongoClient.connect(dbUrl, function (err, db) {
                    if (err) throw reply(err).code(500);

        
                    // create object.
                    const dbase = db.db('kmitl-restful');
                    var data = {
                        studentId : requestData.username,
                        permission : {
                            "entry": 1,
                            "vote": 1
                        }
                    }


                    // CHECK USER EXIST
                    dbase.collection('users').find({"studentId": data.studentId}).toArray(function(err, result) {
                        if (typeof(result[0]) == 'undefined') { // new user.
                            try {


                                // update user upsert.
                                dbase.collection('users').insertOne(data)
                                dbase.collection('users').find({"studentId": requestData.username}).toArray(function(err, response) {
                                    // response token key.
                                    let objId = { id: response[0]._id.toString() };
                                    let token = JWT.sign(objId, 'mysecretKey', { expiresIn: '1d' });
                                    reply({ token: token}).code(200);
                                });


                            } catch (err) { throw err; console.log('[Error] ' + err + "."); return; }
                        } else { // old user.
                            try {


                                // response token key
                                let objId = { id: result[0]._id.toString() }
                                let token = JWT.sign(objId, 'mysecretKey', { expiresIn: '1d' });
                                reply({ token: token }).code(200); 


                            } catch (err) { throw err; console.log('[Error] ' + err + "."); return; }
                        }

                        // display user
                        console.log("[" + data.studentId + "] Logged In.")
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

// ------------------ //
// -- TEACHER PAGE -- //
// ------------------ //
server.route({
    method: 'GET',
    path: '/subject/get',
    handler: (client_request, reply) => {
        MongoClient.connect(dbUrl, function (err, db) {
            const dbase = db.db('kmitl-restful');
            dbase.collection('users').find(ObjectId(client_request.auth.credentials.id)).toArray(function(err, result) {
                if (typeof(result[0]) == 'undefiend') {
                    reply('user notfound.').code(202);
                    return;
                } else {
                    if (result[0].permission.entry >= 2) {
                        dbase.collection('subjects').find({}).toArray(function(err, subject) {
                            if (typeof(subject[0]) == 'undefined') {
                                reply('subject is empty.').code(204);
                            } else if (typeof(subject[0]) != 'undefined') {
                                reply(subject).code(200);
                                return;
                            } else {
                                reply("can't connect dabase server.").code(500);
                            }
                        })
                    }
                }
            });
        });
    }
});
server.route({
    method: 'POST',
    path: '/subject/add',
    handler: (client_request, reply) => {
        MongoClient.connect(dbUrl, function (err, db) {
            const dbase = db.db('kmitl-restful');
            dbase.collection('users').find(ObjectId(client_request.auth.credentials.id)).toArray(function(err, result) {
                if (typeof(result[0]) == 'undefiend') {
                    reply('user notfound.').code(202);
                    return;
                } else {
                    if (result[0].permission.entry >= 2) {
                        dbase.collection('subjects').find({
                            $and: [
                                { "subjects_year": client_request.payload.subjects_year},
                                { "subjects_name": client_request.payload.subjects_name},
                            ]
                        }).toArray(function(err, result) {
                            if (typeof(result[0]) == 'undefined') {
                                dbase.collection('subjects').insertOne(client_request.payload);
                                reply('add success.').code(200);
                            } else if (typeof(result[0]) != 'undefined') {
                                reply('subject is not exist.').code(400);
                                return;
                            } else {
                                reply("can't connect dabase server.").code(500);
                            }
                        })
                    } else {
                        reply('permission denied.').code(202);
                    }
                }
            });
        });
    }
});



server.start(() => {
  console.log("[KMITL - RESTFUL API] Started.");
});

