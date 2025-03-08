const fs = require('fs');
const path = require('path');

// Define the assets to create
const assets = [
  { name: 'icon.png', size: '1024x1024' },
  { name: 'splash.png', size: '2048x2048' },
  { name: 'adaptive-icon.png', size: '1024x1024' },
  { name: 'favicon.png', size: '196x196' },
];

// Create the assets directory if it doesn't exist
const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir);
}

// Create the images directory if it doesn't exist
const imagesDir = path.join(assetsDir, 'images');
if (!fs.existsSync(imagesDir)) {
  fs.mkdirSync(imagesDir);
}

// Create a placeholder background image for the login screen
const blankImage = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

fs.writeFileSync(path.join(imagesDir, 'budget-background.jpg'), blankImage);

// Create placeholder assets
assets.forEach(asset => {
  fs.writeFileSync(path.join(assetsDir, asset.name), blankImage);
  console.log(`Created placeholder for ${asset.name} (${asset.size})`);
});

console.log('All placeholder assets created. Replace with actual assets before deploying.');
