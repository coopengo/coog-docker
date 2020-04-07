# Certificats SSL sur le localhost
wget https://github.com/FiloSottile/mkcert/releases/download/v1.4.1/mkcert-v1.4.1-linux-amd64
sudo mv mkcert-v1.4.1-linux-amd64 /usr/local/bin/mkcert
sudo chmod +x /usr/local/bin/mkcert
mkcert -install
mkcert -cert-file certs/localhost-cert.pem -key-file certs/localhost-key.pem "coog.localhost" ""

# coog-traefik

Init DB :
  ep  admin -u ir res -d coog


