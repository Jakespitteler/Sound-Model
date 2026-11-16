# Restricted laptops

The approved product runs in a browser. End users should not need administrator access or
local package installation. Hosting has not been selected or approved.

Development currently requires only Git and a text editor for these documents. The proposed
application toolchain needs a supported Node.js installation available to the user; prefer
user-local tooling and avoid global npm packages. Record the actual pinned Node version when
the stack is approved. Do not require sudo, install system services, or change machine policies.

Offline maps and restricted corporate proxy behaviour have not been validated. Map requests
will require network access to the approved provider. Report failures rather than disabling TLS.
