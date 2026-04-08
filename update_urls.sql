UPDATE songs SET file_url = REPLACE(file_url, 'http://localhost:5000', 'https://focused-connection-production-35a6.up.railway.app');
UPDATE songs SET cover_image = REPLACE(cover_image, 'http://localhost:5000', 'https://focused-connection-production-35a6.up.railway.app');
UPDATE artist SET img_url = REPLACE(img_url, 'http://localhost:5000', 'https://focused-connection-production-35a6.up.railway.app');
UPDATE albums SET cover_image = REPLACE(cover_image, 'http://localhost:5000', 'https://focused-connection-production-35a6.up.railway.app');
UPDATE users SET profile_pic = REPLACE(profile_pic, 'http://localhost:5000', 'https://focused-connection-production-35a6.up.railway.app');
UPDATE users SET avatar_url = REPLACE(avatar_url, 'http://localhost:5000', 'https://focused-connection-production-35a6.up.railway.app');
