const fs = require('fs');
let code = fs.readFileSync('d:/tải xuống 2/TẢI ẢNH SHOPEE/assets/index.69efe69f.js', 'utf8');

const cgpt = new RegExp('title:"ChatGPT"\\},"🤖"\\)', 'g');
code = code.replace(cgpt, 'title:"ChatGPT"},"🤖",8,["onClick"])');

const gemini = new RegExp('title:"Gemini"\\},"✨"\\)', 'g');
code = code.replace(gemini, 'title:"Gemini"},"✨",8,["onClick"])');

const copy = new RegExp('title:"Copy Ảnh"\\},"📋"\\)', 'g');
code = code.replace(copy, 'title:"Copy Ảnh"},"📋",8,["onClick"])');

fs.writeFileSync('d:/tải xuống 2/TẢI ẢNH SHOPEE/assets/index.69efe69f.js', code);
console.log('Gemini patch flag found:', code.includes('8,["onClick"]'));
