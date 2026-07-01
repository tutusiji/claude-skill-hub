FROM alpine:3.20

RUN apk add --no-cache git git-daemon lighttpd

# 创建 bare 仓库
RUN mkdir -p /srv/git/claude-skill-hub.git && \
    cd /srv/git/claude-skill-hub.git && \
    git init --bare && \
    git config http.receivepack true && \
    git config http.uploadpack true && \
    touch git-daemon-export-ok && \
    git symbolic-ref HEAD refs/heads/main

# 系统级 gitconfig，解决 dubious ownership
RUN git config --system --add safe.directory '*'

# lighttpd 配置
RUN cat > /etc/lighttpd/lighttpd.conf << 'CONF'
server.modules = ("mod_cgi", "mod_setenv", "mod_alias", "mod_redirect")
server.port = 7789
server.document-root = "/srv/git"
server.upload-dirs = ( "/tmp" )
server.errorlog = "/var/log/lighttpd/error.log"

setenv.add-environment = (
    "GIT_PROJECT_ROOT" => "/srv/git",
    "GIT_HTTP_EXPORT_ALL" => ""
)

$HTTP["url"] =~ "^/git" {
    alias.url = ( "/git" => "/usr/libexec/git-core/git-http-backend" )
    cgi.assign = ( "" => "" )
}
CONF

RUN mkdir -p /var/log/lighttpd

EXPOSE 7789
CMD ["lighttpd", "-D", "-f", "/etc/lighttpd/lighttpd.conf"]
