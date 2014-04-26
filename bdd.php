<?php
try
{
	$bdd = new PDO('mysql:host=localhost;dbname=nodechat', 'root', '');
}
catch (Exception $e)
{
		die('Erreur : ' . $e->getMessage());
}

$bdd->query('SET NAMES utf8');

?>
