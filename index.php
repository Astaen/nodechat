<?php 
include('bdd.php');
$confirmed = false;
if(isset($_GET['token'])) {
	$req = $bdd->prepare('SELECT * FROM users WHERE token =?');
	$req->execute(array(strip_tags(htmlspecialchars($_GET['token']))));
	$data = $req->fetch();
	if($data['email']) {
		$bdd->query("UPDATE users SET confirmed=1 WHERE email='" . $data['email'] . "'");
		$confirmed = true;
	}
}
?>
<html>
<head>
	<meta charset="utf-8">
	<title>Astaen - Nodechat</title>
	<link rel="stylesheet" type="text/css" href="css/style.css">
	<script src="js/jquery-2.1.0.min.js"></script>
	<-- CHANGE ME CHANGE ME CHANGE ME CHANGE ME CHANGE ME CHANGE ME CHANGE ME CHANGE ME --!>
 	<script src="http://CHANGE_ME_TO_YOUR_DOMAIN:1337/socket.io/socket.io.js"></script>
	<script src="js/client.js"></script>
</head>

<body>
	<?php if($confirmed) { echo '<div class="tooltip">Adresse e-mail confirmée</div>'; } ?>
	<div id="login">
		<form action="" id="loginform">
			<input placeholder="Pseudo" type="text" id="username">
			<input placeholder="Mot de passe" type="password" id="password">
			<input type="submit" value="Connexion">
			<div class="register">Inscription</div>
		</form>

		<form action="" id="registerform">
			<input placeholder="Pseudo" type="text" id="username">
			<input placeholder="Email" type="email" id="mail">
			<input placeholder="Email (bis)" type="email" id="mail-bis">
			<input placeholder="Mot de passe" type="password" id="password">
			<input placeholder="Mot de passe (bis)" type="password" id="password-bis">
			<input type="submit" value="Inscription">
		</form>
		<p>Optimisé pour <a target="_blank" href="https://www.google.com/intl/fr_fr/chrome/browser/" alt="Google Chrome">Google Chrome</a></p>
	</div>

	<div id="col">

	</div>

	<div id="chat">

	</div>

	<div id="userbar">
		<form>
			<input type="checkbox" name="notif" id="notifcheck" checked></input>
		</form>
		<form id="entry">
			<input type="text" id="message" autocomplete="off">
			<input type="submit" id="send" value="Envoyer">
		</form>
	</div>
	<audio id="notify"><source src="js/notify.ogg" type="audio/ogg"><source src="js/notify.mp3" type="audio/mpeg"><source src="js/notify.wav" type="audio/wav"></audio>
</body>	



</html>