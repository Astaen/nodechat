var http = require('http');
var md5 = require('MD5');
var escape = require('escape-html');
var media = require('mediaparser'); //Homemade module
var mysql = require('mysql');
var sha256 = require('sha256');
var nodemailer = require("nodemailer");
var config = require('./config.json');
var episode = false;

/* TODO :
- Create a Pool for Mysql Connections (to avoid calling createConnexion everytime)
*/

/*Todo, store the topic in database */
var topic = '<strong>Bienvenue sur Nodechat !</strong>\
<p>Merci de respecter votre prochain et de maintenir la positivité dans le salon.</p>\
<p>Pour connaître les commandes disponibles, tapez "/help".</p>';

var slang = ["connard", "connasse", "enculé", "salope", "pute", "fils de pute"]; //Censoring, does not reflect my anger against Javascript

var transport = nodemailer.createTransport("SMTP", {
    host: config.mail.host, // hostname
    port: config.mail.port, // port for secure SMTP
    auth: {
        user: config.mail.user,
        pass: config.mail.password
    }
});

function randStr(size)
{
    var text = "";
    var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

    for( var i=0; i < size; i++ )
        text += possible.charAt(Math.floor(Math.random() * possible.length));

    return text;
}

function mail(user, message) { // Sends a mail using nodemailer
	mailOptions = {
	    from: "Nodechat",
	    to: user,
	    subject: "NodeChat",
	    html: message
	}
	transport.sendMail(mailOptions);	
}


function urlify(text) {
    var urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.replace(urlRegex, function(url) {
        return '<a target="_blank" href="' + url + '">' + url + '</a>';
    })
}


/********************************************************************
*
* Creates an HTTP server and starts Socket.io
*
*********************************************************************/

httpServer = http.createServer(function(req, res) {
});
httpServer.listen(1337);

var io = require('socket.io').listen(httpServer);
io.set('log level', 0); //Less feedback pls

var users = {}; // Stores every connected user
var messages = []; // Stores last <history_length> messages
var history = 20; // History length

var last_message = { //Stores the last message
	message : false,
	media : false,
	user : false,
	date : false,
	h : false,
	m : false,
	s :	false
}




/********************************************************************
*
* For each client connection ...
*
*********************************************************************/
io.sockets.on('connection', function(socket) {

	if(episode) {
		socket.emit('episode');
	};

	var me = false; // Current user infos
	var count = 0;

	for(var i in users){ // New client connected, send him every connected user
		socket.emit('newusr', users[i]);
	};

	for(var i in messages){ // New client connected, send him last messages
		socket.emit('newmsg', messages[i]);
	};

	/***********************************
	*
	* The client registers
	*
	***********************************/
	socket.on('register', function(user) {
		if(user.username.split(" ")[1]) { //Prevent spaces in username
			socket.emit('tooltip', "Pas d'espace dans un pseudo !");
			return false;
		}
		var bdd = mysql.createConnection('mysql://' + config.bdd.username + ':' +config.bdd.password + '@' + config.bdd.host + '/db?database=' + config.bdd.database + '&charset=utf-8');
		bdd.connect();
		var data;
		var req = 'SELECT * FROM users WHERE username = ' + bdd.escape(user.username) + ' OR email = ' + bdd.escape(user.mail);
		bdd.query(req, function(err, result) {
			if(result[0]) { //If a result is returned, either username or mail already exists
				socket.emit('tooltip', "Ce pseudo ou cet email est déjà pris");
				bdd.end();
			} else {
				token = randStr(5);
				req = 'INSERT INTO users(username, email, password, token) VALUES("' + user.username + '", "' + user.mail + '", "' + sha256(user.password) + '", "' + token + '")';
				bdd.query(req, function(err, result) {
					socket.emit('registered');
					/* Sucessfully registered, send a confirmation mail */
					mail(user.mail, '<p>Bonjour ' + user.username + '!</p><p>Confirme ton adresse Nodechat en cliquant ici :<p><a href="http://chat.astaen.fr/?token=' + token + '">Lien</a>');
					bdd.end();
				});
			}
		});
	});
	
	/***********************************
	*
	* The client connects
	*
	***********************************/
	socket.on('login', function(user) {
		var bdd = mysql.createConnection('mysql://' + config.bdd.username + ':' + config.bdd.password + '@' + config.bdd.host + '/db?database=' + config.bdd.database + '&charset=utf-8');
		bdd.connect();
		var data;
		var req = 'SELECT username, email, password, confirmed, op FROM users WHERE username = ' + bdd.escape(user.username);
		bdd.query(req, function(err, result) {											/***** BDD start *****/

			if(result[0]) {

				if(result[0].password == sha256(user.password)) {

						if(result[0].confirmed) {
							me = result[0];
							me.id = md5(me.username);
							me.avatar = 'https://gravatar.com/avatar/' + md5(me.email) + '?s=50';
							me.op = me.op;
							me.socket = socket.id;
							me.afk = false;

							if(!users[me.id]) {
								socket.emit('logged', me.username); //L'utilisateur est connecté
								users[me.id] = me;
								io.sockets.emit('newusr', me); //Un nouvel utilisateur est connecté
								console.log("Nouvel utilisateur connecté : " + me.username + " (" + me.email + ")");
								serverMsg(topic, "self");
								bdd.end();		
							} else { socket.emit('tooltip', "Utilisateur déjà connecté"); } //users[me.id] == true, current client is already connected to the chat

						} else { socket.emit('tooltip', "Tu dois confirmer ton adresse email"); } //result[0] == false, user has not confirmed his mail

				} else { socket.emit('tooltip', "Email / Mot de passe incorrect"); } //resulted password does not match entered password

			} else { socket.emit('tooltip', "Cet utilisateur n'existe pas");	} //result[0] == false, user does not exists
			
		});																			/***** BDD stop *****/

	});


	/***********************************
	*
	* Client sends a message
	*
	***********************************/
	socket.on('newmsg', function(message) {

		if(message.message.substring(0,1) == "/") { //first character is a slash, command
			message.message = urlify(message.message);
			sendCommand(message.message.substring(1));

		} else if(message.message != '' && message.message.replace(/ /g,"").replace(/ /g,"") != '') { //message isn't empty and doesn't contain only spaces
			
			message = generateMsg(message.message,0); //generate message object

			var diff = Math.abs(message.date - last_message.date); // time difference since last message was posted
			if(last_message.user == me && last_message.m == message.m && diff < 10000) { //last message was posted less than 10 seconds ago by same user as current
				count++;
				if(!me.op && count > 3 || isNaN(diff)) { 
					serverMsg("Tu écris trop vite. Merci de patienter 10 secondes avant de reposter.", "self")
				} else { //User is still allowed to post 3 messages with less than a 10 second break
					messages.push(message);
					io.sockets.emit('newmsg', message);						
				}
			} else { //last message wasn't mine, I'm not spamming
				count = 0;
				messages.push(message);
				io.sockets.emit('newmsg', message);					
			}

		}		

		if(me.afk) { //Gets user out of afk state if he posts
			users[me.id].afk = false;
			io.sockets.emit('afk', me.id);
		}

		if(messages.length > history) { //Keep messages history to <history_length> by removing the last one
			messages.shift();
		}

		last_message = message;
	});


	/**********************************
	*
	* Client leaves
	*
	**********************************/
	socket.on('disconnect', function() {
		if(!me) {
			return false;
		}
		delete users[me.id]; //deletes current user from user list
		io.sockets.emit('disusr', me); //sends everyone notice that the current user has left
	});

	function generateMsg(message, mode, recipient) { //generate a message object from variables
		/* Modes *
		* 0 = normal
		* 1 = private
		* 2 = server
		************/

		for(var i in slang) {
			if((message.indexOf(slang[i])) !== -1) { //censored term is found in message
				stars = "*";
				stars = new Array(slang[i].length+1).join(stars);
				message = message.replace(slang[i], stars); //replace censored term with "*"
				socket.emit('tooltip',"Attention à ton language, trop de vulgarité peut mener à un ban.");
			}
		}

		var obj = {};
		if(mode == 0 || mode == 1) {
			obj.message = escape(message);
		} else {
			obj.message = message;
		}
		obj.message = urlify(obj.message);
		obj.media = media.parse(message); //check message for youtube links, imgur, and more, media's attributes can be used to embed each media (see mediaparser for return values)
		obj.user = me; //current user informations are stored in every message
		obj.date = new Date();
		obj.h = obj.date.getHours();
		obj.m = obj.date.getMinutes();
		obj.s = obj.date.getSeconds();
		obj.recipient = false; //message only has a recipient if it is a private message

		if(mode == 2) { //message is a server message
			obj.user = { id : 1, username : "Serveur", avatar : "http://astaen.fr/nodechat/img/server.png"}
		} else if (mode == 1) { //message is a private message, set the recipient
			obj.recipient = recipient;
			obj.private = true;
		}

		if(message.indexOf("@") != -1) { //someone is mentionned
			user = message.substring(message.indexOf("@")+1).split(" ")[0];
			if(users[md5(user)]) { //if mentionned user exists (is online)
				obj.recipient = users[md5(user)].username;
				obj.mention = true;
			}
		}

		return(obj);
	}


	/**********************************
	*
	* Chat commands
	*
	**********************************/

	function sendCommand(command) {
		var op_value;
		console.log('Commande entrée : "/' + command + '" par ' + me.username);
		parameters = command.substring(command.split(" ")[0].length+1); //parameters are everything after the command word
		command = command.split(" ")[0];
		switch(command) {
			case "help":
				if(me.op) {
					serverMsg('<strong>Voici la liste des commandes disponibles sur le chat :</strong>\
								<br/><p><strong>/mp "pseudo" "message"</strong> - Envoyer un message privé.</p>\
								<p><strong>/topic</strong> - Relire le message d\'accueil.</p>\
								<p><strong>/list</strong> - Voir la liste des utilisateurs connectés.</p>\
								<p><strong>/afk</strong> - Vous place en statut AFK.</p>\
								<p><strong>/kick "pseudo"</strong> - Kick l\'utilisateur.</p>\
								<p><strong>/kickall</strong> - Kick tout le monde et force le refresh.</p>\
								<p><strong>/bc, /broacast "message"</strong> - Envoie un message du serveur à tout le monde.</p>\
								<p><strong>/op, /deop "pseudo"</strong> - Donne ou retire le rang opérateur.</p>', "self");
				} else {
					serverMsg('<strong>Voici la liste des commandes disponibles sur le chat :</strong>\
								<br/><p><strong>/mp "pseudo" "message"</strong> 		- Envoyer un message privé.</p>\
								<p><strong>/topic</strong> 		- Relire le message d\'accueil.</p>\
								<p><strong>/list</strong> 		- Voir la liste des utilisateurs connectés.</p>\
								<p><strong>/afk</strong> 		- Vous place en statut AFK.</p>', "self");
				}
				break;
			case "topic":
				serverMsg(topic, "self");
				break;
			case "list":
				message = "<strong>Utilisateurs connectés :</strong><br/>";
				for(var i in users){
					message += "<p>" + users[i].username + "</p>";
				};
				serverMsg(message, "self");
				break;
			case "afk":
				if(me.afk) {
					serverMsg(me.username + " n'est plus afk.", "all");
					users[me.id].afk = false;
					io.sockets.emit('afk', me.id);
				} else {
					serverMsg(me.username + " est maintenant afk.", "all");
					users[me.id].afk = true;
					io.sockets.emit('afk', me.id);
				}
				break;
			case "mp":
				username = parameters.substring(0,parameters.split(" ")[0].length);
				message = parameters.substring(username.length);
				if(users[md5(username)]) {
					privateMsg(message, username);
				} else { socket.emit('tooltip', "Utilisateur introuvable"); }
				break;
			case "clear":
				if(me.op) {
					messages.length = 0; //On vide la variable messages
					io.sockets.emit('clear');
					serverMsg("Nettoyage du salon", "all");
				} else {
					socket.emit('tooltip', "Vous n'avez pas la permission");
				}				
				break;

			case "bc":
			case "broadcast":
				if(me.op) {
					serverMsg("Broadcast : " + parameters);
				} else {
					socket.emit('tooltip', "Vous n'avez pas la permission");
				}
				break;

			case "kickall":
				if(me.op) {
					socket.broadcast.emit('kickall');
				} else {
					socket.emit('tooltip', "Vous n'avez pas la permission");
				}
				break;
			case "kick":
				if(me.op) {
					username = parameters.replace(" ", "");
					if(users[md5(username)]) {
					socketid = users[md5(username)].socket;
					io.sockets.socket(socketid).disconnect('banned');
					serverMsg("L'utilisateur " + username + " a été kické.", "all");						
					} else { socket.emit('tooltip', "Utilisateur introuvable"); }
				} else {
					socket.emit('tooltip', "Vous n'avez pas la permission");
				}
				break;
			case "episode":
				if(!episode) {
					episode = true;
					io.sockets.emit('episode');
					io.sockets.emit('tooltip', 'C\'est l\'heure de l\'épisode !');
				} else {
					episode = false;
					io.sockets.emit('episode');
					io.sockets.emit('tooltip', 'Episode terminé !');
				}
				break;
			case "op":
				op_value = 1;
				op_message = "Vous avez été promu Opérateur";
				op_tooltip = "L'utilisateur %d est maintenant Opérateur";
			case "deop":
				if(!op_value) {
					op_value = 0;
					op_message = "Vous n'êtes plus Opérateur";
					op_tooltip = "L'utilisateur %d n'est plus Opérateur";
				}
				if(me.op) {
					username = parameters.replace(" ", "");
					var bdd = mysql.createConnection('mysql://' + config.bdd.username + ':' + config.bdd.password + '@' + config.bdd.host + '/db?database=' + config.bdd.database + '&charset=utf-8');
					bdd.connect();
					var req = 'UPDATE users SET op=' + op_value + ' WHERE username = ' + bdd.escape(username);
					bdd.query(req, function(err) {
						if(users[md5(username)]) {
							socketid = users[md5(username)].socket;
							users[md5(username)].op = op_value;
							message = serverMsg(op_message);
							io.sockets.socket(socketid).emit('newmsg', message);
							socket.emit('tooltip', op_tooltip.replace("%d", username));
						} else { socket.emit('tooltip', "L'utilisateur " + username + " est introuvable."); }
					});
					bdd.end();
				} else {
					socket.emit('tooltip', "Vous n'avez pas la permission");
				}			
				break;
			default:
				socket.emit('tooltip', "Commande inconnue");
		}

	};

	function serverMsg(message, recipient) { //sends a message as the server
		obj = generateMsg(message, 2, recipient);
		if(recipient === "self") { //recipient can be set to 'self' so only the current user gets it (automated messages)
			socket.emit('newmsg', obj);
		} else {
			io.sockets.emit('newmsg', obj);
		}
		
	};

	function privateMsg(message, recipient) { //sends a private message to recipient
		obj = generateMsg(message, 1, recipient);
		socketid = users[md5(recipient)].socket; //gets recipient socket id

		socket.emit('newmsg', obj);
		io.sockets.socket(socketid).emit('newmsg', obj); //both sender and recipient gets the message displayed
	}

});