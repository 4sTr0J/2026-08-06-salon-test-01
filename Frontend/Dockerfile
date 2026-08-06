FROM nginx:alpine

# Copy static frontend files to Nginx web root
COPY . /usr/share/nginx/html

# Copy custom Nginx configuration to support port 3000 and clean URLs
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
