var intval;
var myself = "";
var episode = false;
var allownotifications = true;
var blurcount = 0;
var iteration = 0;
var blink = false;

$(document).ready(function() {

	/* CHANGE ME 
	*  CHANGE ME 
	*  CHANGE ME 
	*  CHANGE ME 
	*  CHANGE ME */
 	var socket = io.connect('http://CHANGE_ME_TO_YOUR_DOMAIN:1337/');

	var lastmsg = false;
	var hidden;
	var scrolling = false;

	$('#loginform').submit(function(event) {
		event.preventDefault();
		if(!socket) {
			tooltip("Une erreur s\'est produite, merci de réessayer plus tard.", 1);
		}
		socket.emit('login', {
			username : $('#username').val(),
			password     : $('#password').val()

		});
	});

	$('#registerform').submit(function(event) {
		event.preventDefault();
		var empty = $(this).find("input").filter(function() {
			return this.value === "";
		});
		if(empty.length) {
		 alert("Tous les champs doivent être remplis");
		} else {
			if( $('#registerform #password').val() != $('#registerform #password-bis').val() )  {
				$('#registerform').removeClass('shake').addClass('shake');
				$('.error').removeClass('error');
				$('#registerform #password, #registerform #password-bis').addClass('error');
				return false;
			}
			if ($('#registerform #mail').val() != $('#registerform #mail-bis').val()) {
				$('#registerform').removeClass('shake').addClass('shake');
				$('.error').removeClass('error');
				$('#registerform #mail, #registerform #mail-bis').addClass('error');
				return false;
			}
			socket.emit('register', {
				username : $('#registerform #username').val(),
				mail     : $('#registerform #mail').val(),
				password     : $('#registerform #password').val()
			});

		}

	});

	$('.register').click(function() {
		$('#loginform').hide();
		$('#registerform').fadeIn("fast");
		$('#registerform input').css( "display", "block");
	});

	socket.on('registered', function() {
			tooltip("Inscription réussie, vérifie tes mails.", 0);
			$('#registerform').hide();
			$('#loginform').fadeIn("fast");
	});

	socket.on('tooltip', function(message) {
		tooltip(message, 1);
	});

	/**
	*
	* Envoi de messages
	*
	**/

	$('#entry').submit(function(event) {
		event.preventDefault();
		socket.emit('newmsg', {message: $('#message').val()});
		$('#message').val('');
		$('#message').focus();
	});
	

	/**
	*
	* Réception de message
	*
	**/

	socket.on('newmsg', function(message) {

		if($('#chat .post').length > 70) {
			$('#chat .post')[0].remove();
		}

		if(lastmsg != message.user.id) {
			$('#chat').append('<div class="separator"></div>');
			lastmsg = message.user.id;
		}

		hidden = document.mozHidden || document.webkitHidden || document.msHidden || document.hidden;
		if(hidden && !iteration) {
			blurcount++;
			document.title = "Astaen - Nodechat (" + blurcount + ")";
		}

		postMsg(message);

		$('#chat').scrollTop($('#chat').prop('scrollHeight'));	
	});
	

	/**
	* Gestion des connectés
	**/

	socket.on('logged', function(username) {
		myself = username;
		$('#message').focus();
		$('#login').fadeOut("fast");
		$('.blur').removeClass('blur');
	})

	socket.on('newusr', function(user) {
		if(user.afk) {
			$('#col').append('<div class="user afk" id="' + user.id + '"><img src="' + user.avatar + '" title="' + user.username + '"/><span>' + user.username + '</span></div>');
		} else {
			$('#col').append('<div class="user" id="' + user.id + '"><img src="' + user.avatar + '" title="' + user.username + '"/><span>' + user.username + '</span></div>');
		}
		tooltip(user.username + " a rejoint le salon.", 0);
	});

	socket.on('disusr', function(user) {
		$("#" + user.id).remove();
		tooltip(user.username + " a quitté le salon.", 1);
	});

	/**
	* Autres requêtes
	**/

	socket.on('episode', function(embed) {
		if(!episode) {
			$('#col, #chat, #entry, #login').addClass('episode');
			$('#col').append('<div class="video"><iframe width="720" height="430" src="http://www.ustream.tv/embed/16407308?v=3&amp;wmode=direct" scrolling="no" frameborder="0" style="border: 0px none transparent;">    </iframe><br /></div>');
			episode = true;
		} else {
			$('#col, #chat, #entry').removeClass('episode');
			$('#col .video').remove();
			episode = false;
		}
	});

	socket.on('clear', function() {
		$('.post').remove();
		$('.separator').remove();
	});
	socket.on('kickall', function() {
		window.location.reload(true);
	});
	socket.on('afk', function(id) {
		$('#'+id).toggleClass('afk');
	});

	socket.on('disconnect', function(reason, message) {
		$('#login').show();
		$('#entry input').prop('disabled', true);
		$('#col .user').remove();

		if(reason == "booted") {
			socket.disconnect();
			tooltip("Tu as été kické du chat.", 1);
		} else {
			tooltip("Erreur de connexion.", 1);
			var reconnect = setInterval(function() {
				if(!socket.socket.connected) {
					tooltip("Tentative de reconnexion ...", 1);
				} else {
					tooltip("Connecté au serveur ! Merci de vous reconnecter.", 0);
					$('#entry input').prop('disabled', false);
					clearInterval(reconnect);
				}
			}, 5000)
		}

	});

}) //End of document ready


$(document).on("click", ".mention.post .nickname, .post .nickname", function(e) {
    $("#message").val("@" + $(this).text() + " : ");
    $("#message").focus();
});

$(document).on("click", '#notifcheck', function() {
	console.log("check");
	if($(this).is('checked')) {
		allownotifications = true;
	} else {
		allownotifications = false;
	}
});

$(document).on("click", ".private.post .nickname", function(e) {
    $("#message").val("/mp " + $(this).attr('id') + " ");
    $("#message").focus();
});
 
$(document).on("click", ".user", function(e) {
	if(episode) {
		
	} else {
		$('#chat, #entry').toggleClass('minimized');
	}	
});

$(document).on("click", ".media", function(e) {
	$(this).toggleClass('visible');
	$('.visible').not(this).removeClass('visible');
	$('#chat').scrollTop($('#chat').prop('scrollHeight'));
});


function tooltip(message, level) {
	$('.tooltip').remove();
	if(level) {
		$('body').append('<div class="tooltip red">' + message + '</div>');
	} else {
		$('body').append('<div class="tooltip">' + message + '</div>');
	}
}

function postMsg(message) {
	var embed = "";
	if(message.media.youtube) {
		embed += '<div class="media"><iframe width="560" height="315" src="//www.youtube.com/embed/' + message.media.youtube + '?rel=0" frameborder="0" allowfullscreen></iframe></div>';
	}
	if(message.media.imgur) {
		embed += '<div class="media"><img width="500" src="' + message.media.imgur + '" /></div>';
	}
	if(message.media.puush) {
		embed += '<div class="media"><img width="500" src="http://puu.sh/' + message.media.puush + '" /></div>';
	}
	if(message.media.soundcloud) {
		embed += '<div class="media"><iframe width="100%" height="166" scrolling="no" frameborder="no" src="https://w.soundcloud.com/player/?url=' + message.media.soundcloud + '&amp;color=ff5500&amp;auto_play=false&amp;hide_related=false&amp;show_artwork=true"></iframe></div>'
	}

	if(message.user.op) {
		divclass = "op post";
	} else if (message.user.id == 1) {
		divclass = "server post";
	} else {
		divclass = "post";
	}

	if(message.private) {
		divclass = "private post";
		if(message.recipient == myself) {
		notify('sound');
		notify('tab', "Nouveau message privé !");			
		}
		post = '<div class="' + divclass + '"><img src="' + message.user.avatar + '" /><p class="nickname" id="' + message.user.username + '">' + message.user.username + ' > ' + message.recipient + '</p><p>' + message.message + embed + '</p><p class="date">' + message.h + ' : ' + message.m + '</p></div>'; 
	} else if(message.mention && message.recipient == myself) {
		divclass = "mention post";
		notify('sound');
		notify('tab', "Nouvelle mention !");
		message.message = message.message.replace("@" + myself, '<span class="usermention">@' + myself + '</span>');
		post = '<div class="' + divclass + '"><img src="' + message.user.avatar + '" /><p class="nickname">' + message.user.username + '</p><p>' + message.message + embed + '</p><p class="date">' + message.h + ' : ' + message.m + '</p></div>'; 
	} else {
		post = '<div class="' + divclass + '"><img src="' + message.user.avatar + '" /><p class="nickname">' + message.user.username + '</p><p>' + message.message + embed + '</p><p class="date">' + message.h + ' : ' + message.m + '</p></div>'; 
	}

	$('#chat').append(post);
}

function notify(mode, option) {
	if (allownotifications) {
		switch(mode) {
			case "sound":
				$('#notify')[0].play();			
				break;
			case "tab":
				var prev_title = document.title;
				var new_title = option;
				blink = setInterval(function(prev_title, new_title) {

					if(document.title == prev_title) {
						document.title = new_title;
					} else {
						document.title = prev_title;
					}
					iteration++;
					if(iteration >= 6) {
					clearInterval(blink);
					iteration = 0;
					}
				}.bind(null, prev_title, new_title), 1000);
				break;
		}
	}
}

(function(){
        document.addEventListener("visibilitychange", function(){
                var hidden = document.mozHidden || document.webkitHidden || document.msHidden || document.hidden;
                if(!hidden) {
                	if(blink) {
	             		clearInterval(blink);
	            		blink = false;                 		
                	}            	
                	iteration = 0;
                	document.title = "Astaen - Nodechat";
                	blurcount = 0;
                }
        }, false);
}).call(this);