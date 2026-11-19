root /opt/maxxpixels-ott/current/admin;
index index.html;
client_max_body_size 500m;

# Use ^~ prefix locations (not regex): a prefix match with ^~ is never overridden by a
# static-asset/image-extension regex location further down the server block. Admin images
# are served by the backend because posters/banners live in Bunny Storage, not on disk here.
location ^~ /api/ {
    include /etc/nginx/snippets/maxxpixels-proxy-headers.conf;
    proxy_pass http://maxx_api;
}

location ^~ /uploads/ {
    include /etc/nginx/snippets/maxxpixels-proxy-headers.conf;
    proxy_pass http://maxx_api;
}

location ^~ /storage/ {
    include /etc/nginx/snippets/maxxpixels-proxy-headers.conf;
    proxy_pass http://maxx_api;
}

location ^~ /content/ {
    include /etc/nginx/snippets/maxxpixels-proxy-headers.conf;
    proxy_pass http://maxx_api;
}

location ^~ /posters/ {
    include /etc/nginx/snippets/maxxpixels-proxy-headers.conf;
    proxy_pass http://maxx_api;
}

location ^~ /banners/ {
    include /etc/nginx/snippets/maxxpixels-proxy-headers.conf;
    proxy_pass http://maxx_api;
}

location ^~ /branding/ {
    include /etc/nginx/snippets/maxxpixels-proxy-headers.conf;
    proxy_pass http://maxx_api;
}

location ^~ /notification/ {
    include /etc/nginx/snippets/maxxpixels-proxy-headers.conf;
    proxy_pass http://maxx_api;
}

location ^~ /ads/ {
    include /etc/nginx/snippets/maxxpixels-proxy-headers.conf;
    proxy_pass http://maxx_api;
}

location ^~ /actuator/ {
    include /etc/nginx/snippets/maxxpixels-proxy-headers.conf;
    proxy_pass http://maxx_api;
}

location ^~ /socket.io/ {
    include /etc/nginx/snippets/maxxpixels-proxy-headers.conf;
    proxy_pass http://maxx_api;
}

location = /index.html {
    add_header Cache-Control "no-cache";
}

location = /sw.js {
    add_header Cache-Control "no-cache";
}

location / {
    try_files $uri $uri/ /index.html;
}
