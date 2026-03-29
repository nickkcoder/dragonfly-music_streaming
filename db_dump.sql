-- MySQL dump 10.13  Distrib 8.0.43, for Win64 (x86_64)
--
-- Host: localhost    Database: dragonflydb
-- ------------------------------------------------------
-- Server version	8.0.43

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `admin_permissions`
--

DROP TABLE IF EXISTS `admin_permissions`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `admin_permissions` (
  `permission_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `can_upload` tinyint(1) DEFAULT '0',
  `can_edit_artists` tinyint(1) DEFAULT '0',
  `can_delete_songs` tinyint(1) DEFAULT '0',
  PRIMARY KEY (`permission_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `admin_permissions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `admin_permissions`
--

LOCK TABLES `admin_permissions` WRITE;
/*!40000 ALTER TABLE `admin_permissions` DISABLE KEYS */;
INSERT INTO `admin_permissions` VALUES (1,2,0,0,0);
/*!40000 ALTER TABLE `admin_permissions` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `albums`
--

DROP TABLE IF EXISTS `albums`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `albums` (
  `album_id` int NOT NULL AUTO_INCREMENT,
  `artist_id` int NOT NULL,
  `title` varchar(999) DEFAULT NULL,
  `cover_image` varchar(300) DEFAULT NULL,
  `release_date` date DEFAULT NULL,
  PRIMARY KEY (`album_id`),
  KEY `artist_id` (`artist_id`),
  CONSTRAINT `albums_ibfk_1` FOREIGN KEY (`artist_id`) REFERENCES `artist` (`artist_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `albums`
--

LOCK TABLES `albums` WRITE;
/*!40000 ALTER TABLE `albums` DISABLE KEYS */;
/*!40000 ALTER TABLE `albums` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `artist`
--

DROP TABLE IF EXISTS `artist`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `artist` (
  `artist_id` int NOT NULL AUTO_INCREMENT,
  `artist_name` varchar(100) NOT NULL,
  `bio` text,
  `img_url` varchar(300) DEFAULT NULL,
  `verified` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `genre` varchar(100) DEFAULT NULL,
  PRIMARY KEY (`artist_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `artist`
--

LOCK TABLES `artist` WRITE;
/*!40000 ALTER TABLE `artist` DISABLE KEYS */;
INSERT INTO `artist` VALUES (1,'Test Artist','This is a test artist.','uploads/test.jpg',0,'2025-12-04 20:26:43',NULL),(4,'Lana Del Rey','Soon','http://localhost:5000/uploads/artist_4/1773855501998-553431255.jpeg',0,'2026-03-09 17:29:57',NULL),(5,'CallmeaNigger','2000s recording artiste from New Jersey',NULL,0,'2026-03-29 17:05:17','HipHop');
/*!40000 ALTER TABLE `artist` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `artist_acc`
--

DROP TABLE IF EXISTS `artist_acc`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `artist_acc` (
  `artist_acc_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `artist_id` int NOT NULL,
  PRIMARY KEY (`artist_acc_id`),
  UNIQUE KEY `user_id` (`user_id`),
  UNIQUE KEY `artist_id` (`artist_id`),
  CONSTRAINT `artist_acc_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `artist_acc_ibfk_2` FOREIGN KEY (`artist_id`) REFERENCES `artist` (`artist_id`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `artist_acc`
--

LOCK TABLES `artist_acc` WRITE;
/*!40000 ALTER TABLE `artist_acc` DISABLE KEYS */;
INSERT INTO `artist_acc` VALUES (3,5,5);
/*!40000 ALTER TABLE `artist_acc` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `deleted_entities`
--

DROP TABLE IF EXISTS `deleted_entities`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `deleted_entities` (
  `deletion_id` bigint NOT NULL AUTO_INCREMENT,
  `entity_type` varchar(40) NOT NULL,
  `entity_id` int NOT NULL,
  `payload` longtext NOT NULL,
  `deleted_by` int DEFAULT NULL,
  `deleted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `expires_at` datetime NOT NULL,
  `restored_at` datetime DEFAULT NULL,
  PRIMARY KEY (`deletion_id`),
  KEY `idx_deleted_active` (`restored_at`,`expires_at`),
  KEY `idx_deleted_type_id` (`entity_type`,`entity_id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `deleted_entities`
--

LOCK TABLES `deleted_entities` WRITE;
/*!40000 ALTER TABLE `deleted_entities` DISABLE KEYS */;
INSERT INTO `deleted_entities` VALUES (1,'artist_bundle',1,'{\"artist\":{\"artist_id\":1,\"artist_name\":\"Test Artist\",\"bio\":\"This is a test artist.\",\"img_url\":\"uploads/test.jpg\",\"verified\":0,\"created_at\":\"2025-12-04T15:26:43.000Z\"},\"artist_acc\":[],\"songs\":[{\"song_id\":2,\"artist_id\":1,\"album_id\":null,\"genre_id\":null,\"title\":\"Test Upload Song\",\"file_url\":\"uploads/test-file.mp3\",\"duration_seconds\":180,\"cover_image\":null,\"uploaded_by\":2,\"uploaded_at\":\"2025-12-04T15:27:24.000Z\"}]}',2,'2026-03-09 16:41:08','2026-03-09 11:51:08','2026-03-09 11:44:38'),(2,'song',3,'{\"song\":{\"song_id\":3,\"artist_id\":4,\"album_id\":null,\"genre_id\":null,\"title\":\"dragon\",\"file_url\":\"http://localhost:5000/uploads/artist_4/1773079544258-479538747.mp3\",\"duration_seconds\":null,\"cover_image\":\"http://localhost:5000/uploads/artist_4/1773079544107-430728666.png\",\"uploaded_by\":2,\"uploaded_at\":\"2026-03-09T18:05:44.000Z\"}}',2,'2026-03-09 18:05:51','2026-03-09 13:15:51',NULL);
/*!40000 ALTER TABLE `deleted_entities` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `genres`
--

DROP TABLE IF EXISTS `genres`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `genres` (
  `genre_id` int NOT NULL AUTO_INCREMENT,
  `genre_name` varchar(100) NOT NULL,
  PRIMARY KEY (`genre_id`),
  UNIQUE KEY `genre_name` (`genre_name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `genres`
--

LOCK TABLES `genres` WRITE;
/*!40000 ALTER TABLE `genres` DISABLE KEYS */;
/*!40000 ALTER TABLE `genres` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `playlist_songs`
--

DROP TABLE IF EXISTS `playlist_songs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `playlist_songs` (
  `playlist_id` int DEFAULT NULL,
  `song_id` int DEFAULT NULL,
  `position` int DEFAULT NULL,
  KEY `playlist_id` (`playlist_id`),
  KEY `song_id` (`song_id`),
  CONSTRAINT `playlist_songs_ibfk_1` FOREIGN KEY (`playlist_id`) REFERENCES `playlists` (`playlist_id`),
  CONSTRAINT `playlist_songs_ibfk_2` FOREIGN KEY (`song_id`) REFERENCES `songs` (`song_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `playlist_songs`
--

LOCK TABLES `playlist_songs` WRITE;
/*!40000 ALTER TABLE `playlist_songs` DISABLE KEYS */;
INSERT INTO `playlist_songs` VALUES (1,4,1);
/*!40000 ALTER TABLE `playlist_songs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `playlists`
--

DROP TABLE IF EXISTS `playlists`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `playlists` (
  `playlist_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `playlist_name` varchar(999) NOT NULL,
  `is_public` tinyint(1) DEFAULT '0',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`playlist_id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `playlists_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=2 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `playlists`
--

LOCK TABLES `playlists` WRITE;
/*!40000 ALTER TABLE `playlists` DISABLE KEYS */;
INSERT INTO `playlists` VALUES (1,2,'Liked Songs',0,'2026-03-09 20:44:20');
/*!40000 ALTER TABLE `playlists` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `songs`
--

DROP TABLE IF EXISTS `songs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `songs` (
  `song_id` int NOT NULL AUTO_INCREMENT,
  `artist_id` int NOT NULL,
  `album_id` int DEFAULT NULL,
  `genre_id` int DEFAULT NULL,
  `title` varchar(999) NOT NULL,
  `file_url` varchar(999) NOT NULL,
  `duration_seconds` int DEFAULT NULL,
  `cover_image` varchar(300) DEFAULT NULL,
  `uploaded_by` int DEFAULT NULL,
  `uploaded_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`song_id`),
  KEY `artist_id` (`artist_id`),
  KEY `album_id` (`album_id`),
  KEY `genre_id` (`genre_id`),
  KEY `uploaded_by` (`uploaded_by`),
  CONSTRAINT `songs_ibfk_1` FOREIGN KEY (`artist_id`) REFERENCES `artist` (`artist_id`),
  CONSTRAINT `songs_ibfk_2` FOREIGN KEY (`album_id`) REFERENCES `albums` (`album_id`),
  CONSTRAINT `songs_ibfk_3` FOREIGN KEY (`genre_id`) REFERENCES `genres` (`genre_id`),
  CONSTRAINT `songs_ibfk_4` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `songs`
--

LOCK TABLES `songs` WRITE;
/*!40000 ALTER TABLE `songs` DISABLE KEYS */;
INSERT INTO `songs` VALUES (2,1,NULL,NULL,'Test Upload Song','uploads/test-file.mp3',180,NULL,2,'2025-12-04 20:27:24'),(4,4,NULL,NULL,'Dragon Slayer','http://localhost:5000/uploads/artist_4/1773080279874-197771785.mp3',NULL,'http://localhost:5000/uploads/artist_4/1773080279852-698164064.jpeg',2,'2026-03-09 18:18:00');
/*!40000 ALTER TABLE `songs` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_likes`
--

DROP TABLE IF EXISTS `user_likes`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_likes` (
  `user_id` int NOT NULL,
  `song_id` int NOT NULL,
  PRIMARY KEY (`user_id`,`song_id`),
  KEY `song_id` (`song_id`),
  CONSTRAINT `user_likes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `user_likes_ibfk_2` FOREIGN KEY (`song_id`) REFERENCES `songs` (`song_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_likes`
--

LOCK TABLES `user_likes` WRITE;
/*!40000 ALTER TABLE `user_likes` DISABLE KEYS */;
INSERT INTO `user_likes` VALUES (2,4);
/*!40000 ALTER TABLE `user_likes` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_listening_history`
--

DROP TABLE IF EXISTS `user_listening_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_listening_history` (
  `history_id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `song_id` int NOT NULL,
  `listened_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`history_id`),
  KEY `user_id` (`user_id`),
  KEY `song_id` (`song_id`),
  CONSTRAINT `user_listening_history_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`user_id`),
  CONSTRAINT `user_listening_history_ibfk_2` FOREIGN KEY (`song_id`) REFERENCES `songs` (`song_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_listening_history`
--

LOCK TABLES `user_listening_history` WRITE;
/*!40000 ALTER TABLE `user_listening_history` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_listening_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_settings`
--

DROP TABLE IF EXISTS `user_settings`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_settings` (
  `user_id` int NOT NULL,
  `privacy_json` longtext,
  `notifications_json` longtext,
  `playback_json` longtext,
  `artist_json` longtext,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_settings`
--

LOCK TABLES `user_settings` WRITE;
/*!40000 ALTER TABLE `user_settings` DISABLE KEYS */;
/*!40000 ALTER TABLE `user_settings` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users`
--

DROP TABLE IF EXISTS `users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users` (
  `user_id` int NOT NULL AUTO_INCREMENT,
  `username` varchar(100) DEFAULT NULL,
  `email` varchar(100) DEFAULT NULL,
  `password_h` varchar(555) DEFAULT NULL,
  `profile_pic` varchar(300) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `roles` varchar(55) DEFAULT 'user',
  `bio` text,
  `accent` varchar(32) DEFAULT NULL,
  `avatar_url` text,
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users`
--

LOCK TABLES `users` WRITE;
/*!40000 ALTER TABLE `users` DISABLE KEYS */;
INSERT INTO `users` VALUES (1,'testuser','test@example.com','$2b$10$qiIOMxL775pEi3FQzo4Mr.6D9jw0ReK59l/elsQyTzK/shUYWmZvi',NULL,'2025-11-26 18:50:43','artist',NULL,NULL,NULL),(2,'admin_user','admin@example.com','$2b$10$JHTP0NcD4WKW/puBCtqLAOleuzUeIiTVnJzkiNLotnEo18Y2iP9bO',NULL,'2025-12-01 14:34:05','admin',NULL,NULL,NULL),(3,'testuser2','testuser@example.com','$2b$10$3KH7mNTFMz0c5f7IwUIiWuBiDKN/kGUkZAXVIYcXdSUnGLPll8Os6',NULL,'2026-02-11 17:46:05','admin',NULL,NULL,NULL),(4,'nick','nicksmall161@gmail.com','$2b$10$gNT2IqxUGB3J.BoKODJsQe.PvK23pn1l22Wv/uyQmStx5AmcMkGoK',NULL,'2026-03-05 18:59:30','artist',NULL,NULL,NULL),(5,'WaytooGeeked','touchmehdont@gmail.com','$2b$10$P6y3BuuXRKgjXoNINHA9t.Uz8h050ReKfFXM5NyaBNCRh6BIK3IDq',NULL,'2026-03-29 17:03:23','artist',NULL,NULL,NULL);
/*!40000 ALTER TABLE `users` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-03-29 16:44:05
