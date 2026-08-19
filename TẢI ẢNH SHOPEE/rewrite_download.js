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
console.log("Original downloadAllImages length:", allImagesBody ? allImagesBody.length : 0);

const zipImagesBody = extractFunc('async downloadImagesZip');
console.log("Original downloadImagesZip length:", zipImagesBody ? zipImagesBody.length : 0);

// We'll replace them with simpler versions.
// Format date: YYYYMMDD_HHmmss
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
            return new Promise((resolve) => {
                chrome.downloads.download({
                    url: url,
                    filename: baseFolder + sub + "/" + prefix + dStr + (i+1) + ".jpeg",
                    saveAs: false
                }, (downloadId) => {
                    downloaded++;
                    updateP();
                    resolve();
                });
            });
        };
        
        const promises = [];
        if(main) for(let i=0; i<main.length; i++) promises.push(dl(main[i], "main", "c", i));
        if(desc) for(let i=0; i<desc.length; i++) promises.push(dl(desc[i], "description", "m", i));
        if(variants) for(let i=0; i<variants.length; i++) promises.push(dl(variants[i].image, "variants", "v", i));
        
        await Promise.all(promises);
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
        
        const promises = [];
        for(let i=0; i<total; i++) {
            let url = e[i];
            if(o==="variant") url = e[i].image;
            promises.push(new Promise((resolve) => {
                chrome.downloads.download({
                    url: url,
                    filename: baseFolder + prefix + dStr + (i+1) + ".jpeg",
                    saveAs: false
                }, (downloadId) => {
                    downloaded++;
                    updateP();
                    resolve();
                });
            }));
        }
        await Promise.all(promises);
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
