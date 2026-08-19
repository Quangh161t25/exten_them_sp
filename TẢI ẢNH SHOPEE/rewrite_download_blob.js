const fs = require('fs');
let code = fs.readFileSync('d:/tải xuống 2/TẢI ẢNH SHOPEE/assets/index.69efe69f.js', 'utf8');

function extractFunc(name) {
    const s = code.indexOf(name + '(');
    if (s === -1) return null;
    let braces = 0;
    let e = -1;
    for (let i = s; i < code.length; i++) {
        if (code[i] === '{') braces++;
        if (code[i] === '}') {
            braces--;
            if (braces === 0) {
                e = i + 1;
                break;
            }
        }
    }
    return code.substring(s, e);
}

const allImagesBody = extractFunc('async downloadAllImages');
const zipImagesBody = extractFunc('async downloadImagesZip');

const dateFmt = `function getD(){const d=new Date();const p=n=>n.toString().padStart(2,'0');return d.getFullYear()+p(d.getMonth()+1)+p(d.getDate())+'_'+p(d.getHours())+p(d.getMinutes())+p(d.getSeconds());}`;

const newDownloadAllImages = `async downloadAllImages(){
    if(!this.requireProFeature())return;
    this.allImagesProgress=0;
    try {
        const title = this.productData.title.replace(/[^a-z0-9]/gi, '_').substring(0,30);
        const variants = this.productData.categoryImages;
        const main = this.productData.mainImages;
        const desc = this.productData.descriptionImages;
        
        let total = (variants?variants.length:0) + (main?main.length:0) + (desc?desc.length:0);
        if(total === 0) return;
        
        ${dateFmt}
        const dStr = getD();
        const baseFolder = "Shopee_" + title + "/";
        
        let downloaded = 0;
        const updateP = () => { this.allImagesProgress = (downloaded/total)*100; if(this.allImagesProgress>=100) setTimeout(()=>this.allImagesProgress=-1, 1000); };
        
        const dl = async (url, sub, prefix, i) => {
            try {
                let res = await fetch(url);
                let blob = await res.blob();
                let objUrl = URL.createObjectURL(blob);
                return new Promise((resolve) => {
                    chrome.downloads.download({
                        url: objUrl,
                        filename: baseFolder + sub + "/" + prefix + dStr + (i+1) + ".jpeg",
                        saveAs: false
                    }, (downloadId) => {
                        if (chrome.runtime.lastError) console.error(chrome.runtime.lastError);
                        downloaded++;
                        updateP();
                        setTimeout(() => URL.revokeObjectURL(objUrl), 10000);
                        resolve();
                    });
                });
            } catch(err) {
                console.error(err);
                downloaded++;
                updateP();
            }
        };
        
        const promises = [];
        if(main) for(let i=0; i<main.length; i++) promises.push(dl(main[i], "main", "c", i));
        if(desc) for(let i=0; i<desc.length; i++) promises.push(dl(desc[i], "description", "m", i));
        if(variants) for(let i=0; i<variants.length; i++) promises.push(dl(variants[i].image, "variants", "v", i));
        
        // Process in batches of 3 to avoid overloading the browser
        for (let i = 0; i < promises.length; i += 3) {
            await Promise.all(promises.slice(i, i + 3));
        }
    } catch(e) {
        console.error("Error downloading:", e);
        this.allImagesProgress = -1;
    }
}`;

const newDownloadImagesZip = `async downloadImagesZip(e, o, r){
    if(!this.requireProFeature())return;
    this.imageProgresses[r]=0;
    try {
        const title = this.productData.title.replace(/[^a-z0-9]/gi, '_').substring(0,30);
        let total = e?e.length:0;
        if(total === 0) return;
        
        ${dateFmt}
        const dStr = getD();
        const baseFolder = "Shopee_" + title + "/" + o + "/";
        
        let prefix = "img";
        if(o === "main") prefix = "c";
        if(o === "desc" || o === "description") prefix = "m";
        if(o === "variant" || o === "variants") prefix = "v";
        
        let downloaded = 0;
        const updateP = () => { this.imageProgresses[r] = (downloaded/total)*100; if(this.imageProgresses[r]>=100) setTimeout(()=>this.imageProgresses[r]=-1, 1000); };
        
        const dl = async (url, i) => {
            try {
                let res = await fetch(url);
                let blob = await res.blob();
                let objUrl = URL.createObjectURL(blob);
                return new Promise((resolve) => {
                    chrome.downloads.download({
                        url: objUrl,
                        filename: baseFolder + prefix + dStr + (i+1) + ".jpeg",
                        saveAs: false
                    }, (downloadId) => {
                        if (chrome.runtime.lastError) console.error(chrome.runtime.lastError);
                        downloaded++;
                        updateP();
                        setTimeout(() => URL.revokeObjectURL(objUrl), 10000);
                        resolve();
                    });
                });
            } catch(err) {
                console.error(err);
                downloaded++;
                updateP();
            }
        };

        const promises = [];
        for(let i=0; i<total; i++) {
            let url = e[i];
            if(o==="variant") url = e[i].image;
            promises.push(dl(url, i));
        }
        
        for (let i = 0; i < promises.length; i += 3) {
            await Promise.all(promises.slice(i, i + 3));
        }
    } catch(err) {
        console.error("Error:", err);
        this.imageProgresses[r] = -1;
    }
}`;

if (allImagesBody && zipImagesBody) {
    code = code.replace(allImagesBody, newDownloadAllImages);
    code = code.replace(zipImagesBody, newDownloadImagesZip);
    fs.writeFileSync('d:/tải xuống 2/TẢI ẢNH SHOPEE/assets/index.69efe69f.js', code);
    console.log("Replaced successfully!");
} else {
    console.log("Could not extract functions");
}
