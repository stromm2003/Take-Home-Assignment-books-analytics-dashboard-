# Frontend image: serve the static dashboard with nginx.
#
# BUILD CONTEXT = frontend/ (see docker-compose.yml). The app is plain
# HTML/CSS/JS with a locally-vendored Chart.js, so there is NO build step —
# we just copy the files into nginx's web root.
#
# The browser reaches the API at http://127.0.0.1:8000 (the backend's published
# port on the host), the same address used in local development, so no config
# needs to change between dev and Docker.

FROM nginx:alpine

# Replace nginx's default site content with our dashboard.
COPY . /usr/share/nginx/html

# nginx serves on port 80 inside the container.
EXPOSE 80
