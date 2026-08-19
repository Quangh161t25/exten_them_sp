const fs = require('fs');

let code = fs.readFileSync('d:/tải xuống 2/exten them sp12/TẢI ẢNH SHOPEE/assets/index.69efe69f.js', 'utf8');

function extractFunc(name) {
    const s = code.indexOf(name);
    if (s === -1) return null;
    let braces = 0;
    let started = false;
    let e = -1;
    for (let i = s; i < code.length; i++) {
        if (code[i] === '{') {
            braces++;
            started = true;
        }
        if (code[i] === '}') {
            braces--;
            if (started && braces === 0) {
                e = i + 1;
                break;
            }
        }
    }
    return code.substring(s, e);
}

const zipFunc = extractFunc('async downloadImagesZip(');

if (zipFunc) {
    const newZipFunc = `async downloadImagesZip(e,o,r){
        if(!this.requireProFeature())return;
        this.imageProgresses[r]=0;
        window.parent.postMessage({
            action: "hijack_category_download",
            urls: e,
            type: o,
            progressId: r
        }, "*");
    }`;
    
    code = code.replace(zipFunc, newZipFunc);
    
    fs.writeFileSync('d:/tải xuống 2/exten them sp12/TẢI ẢNH SHOPEE/assets/index.69efe69f.js', code);
    console.log('Successfully injected postMessage into downloadImagesZip!');
} else {
    console.error('Could not find downloadImagesZip!');
}
