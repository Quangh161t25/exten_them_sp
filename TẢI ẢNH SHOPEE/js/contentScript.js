
((()=>{
    'use strict';
    let a={'isProduct':![],'title':'','mainImages':[],'categoryImages':[],'descriptionImages':[],'videos':[]};
    const b = f => {
        try {
            a['title'] = d(f, ['data', 'item', 'title']);
            a['categoryImages'] = [];
            const h = d(f, ['data', 'product_images', 'first_tier_variations']);
            h != null && (a['categoryImages'] = h['map'](k => ({ 'sku': k?.['name'] ?? '', 'name': k?.['name'] ?? '', 'image': 'https://down-id.img.susercontent.com/file/' + (k?.['image'] ?? '') })));
            a['mainImages'] = [];
            const i = d(f, ['data', 'product_images', 'images']);
            i != null && (a['mainImages'] = i['map'](k => 'https://down-id.img.susercontent.com/file/' + k) ?? []);
            var g = d(f, ['data', 'rich_text_description', 'paragraph_list']);
            g == null && (g = d(f, ['data', 'item', 'rich_text_description', 'paragraph_list']));
            g != null && (a['descriptionImages'] = g['filter'](k => k?.['img_id'])?.['map'](k => 'https://down-id.img.susercontent.com/file/' + k['img_id']) ?? []);
            a['videos'] = [];
            const j = d(f, ['data', 'product_images', 'video']);
            j != null && (j['video_id'] && j['thumb_url'] && (a['videos'] = [{ 'src': 'https://cvf.shopee.com/file/' + j['video_id'], 'cover': 'https://down-id.img.susercontent.com/file/' + j['thumb_url'] }]));
            a['isProduct'] = !![];
            window['postMessage']({ 'action': 'sendProductData', 'data': a }, '*');
        } catch (k) {
            console['error']('Error processing product data:', k);
        }
    };

    const c = window['fetch'];
    window['fetch'] = function(e, f) {
        const g = typeof e === 'string' ? e : e['url'];
        return c(e, f)['then'](h => {
            if (g && typeof g === 'string' && g['includes']('/api/v4/pdp/get_pc')) {
                const i = h['clone']();
                i['json']()['then'](j => { b(j); })['catch'](j => { console['error']('Error processing JSON:', j); });
            }
            return h;
        });
    };

    const origXHR = window.XMLHttpRequest;
    window.XMLHttpRequest = function() {
        const xhr = new origXHR();
        xhr.addEventListener('load', function() {
            if (xhr._url && xhr._url.includes('/api/v4/pdp/get_pc')) {
                try {
                    const j = JSON.parse(xhr.responseText);
                    b(j);
                } catch (e) {
                    console.error('XHR parse error:', e);
                }
            }
        });
        const origOpen = xhr.open;
        xhr.open = function(method, url) {
            xhr._url = url;
            return origOpen.apply(this, arguments);
        };
        return xhr;
    };

    function d(e, f, g = null) {
        if (!Array['isArray'](f)) throw new TypeError('Path must be an array');
        if (typeof e !== 'object' || e == null) return g;
        return f['reduce']((h, i) => {
            if (h == null || typeof h !== 'object' || !(i in h)) return g;
            const j = h[i];
            if (typeof j === 'object' && j !== null && Object['keys'](j)['length'] === 0) return g;
            return j;
        }, e);
    }
})());

