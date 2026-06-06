
front end path and execution code

root@energy-system-set:~# /opt/energy-share/Energy-sharing-project/frontend/
-bash: /opt/energy-share/Energy-sharing-project/frontend/: Is a directory
root@energy-system-set:~# cd /opt/energy-share/Energy-sharing-project/frontend/
root@energy-system-set:/opt/energy-share/Energy-sharing-project/frontend# npm run dev

> frontend@0.1.0 dev
> next dev

▲ Next.js 16.1.6 (Turbopack)
- Local:         http://localhost:3000
- Network:       http://137.63.181.31:3000

✓ Starting...
⚠ Turbopack's filesystem cache has been deleted because we previously detected an internal error in Turbopack. Builds or page loads may be slower as a result.
✓ Ready in 12.6s

thread 'tokio-runtime-worker' (73544) panicked at /usr/local/cargo/registry/src/index.crates.io-1949cf8c6b5b557f/qfilter-0.2.4/src/lib.rs:494:9:
CPU doesn't support the popcnt instruction
note: run with `RUST_BACKTRACE=1` environment variable to display a backtrace

thread 'tokio-runtime-worker' (73545) panicked at /usr/local/cargo/registry/src/index.crates.io-1949cf8c6b5b557f/qfilter-0.2.4/src/lib.rs:494:9:
CPU doesn't support the popcnt instruction
○ Compiling / ...
 GET / 200 in 20.6s (compile: 19.7s, render: 909ms)
⚠ Cross origin request detected from energy-share.sun.ac.ug to /_next/* resource. In a future major version of Next.js, you will need to explicitly configure "allowedDevOrigins" in next.config to allow this.
Read more: https://nextjs.org/docs/app/api-reference/config/next-config-js/allowedDevOrigins
 POST / 200 in 34ms (compile: 5ms, render: 29ms)


//backend path and execution code

root@energy-system-set:/opt# cd energy-share/
root@energy-system-set:/opt/energy-share# ls
Energy-sharing-project
root@energy-system-set:/opt/energy-share# cd Energy-sharing-project/
root@energy-system-set:/opt/energy-share/Energy-sharing-project# ls
Readme.md  backend  frontend
root@energy-system-set:/opt/energy-share/Energy-sharing-project# cd backend/
root@energy-system-set:/opt/energy-share/Energy-sharing-project/backend# ls
accounts  backend  logs       meter     requirements.txt  transactions  utils  wallet
admin     loan     manage.py  mtn_momo  share             transfer      venv   webhooks
root@energy-system-set:/opt/energy-share/Energy-sharing-project/backend# source
.env              backend/          manage.py         requirements.txt  transfer/         wallet/
accounts/         loan/             meter/            share/            utils/            webhooks/
admin/            logs/             mtn_momo/         transactions/     venv/
root@energy-system-set:/opt/energy-share/Energy-sharing-project/backend# source venv/bin/activate
(venv) root@energy-system-set:/opt/energy-share/Energy-sharing-project/backend# python3 manage.py runserver
Watching for file changes with StatReloader
Performing system checks...

System check identified no issues (0 silenced).
March 03, 2026 - 07:05:00
Django version 6.0, using settings 'backend.settings'
Starting development server at http://127.0.0.1:8000/
Quit the server with CONTROL-C.

WARNING: This is a development server. Do not use it in a production setting. Use a production WSGI or ASGI server instead.
For more information on production servers see: https://docs.djangoproject.com/en/6.0/howto/deployment/

