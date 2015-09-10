# Light Control

Control connected outlets using a web interface

## Installation and Running

### Installing Dependencies

To install all dependencies:
```
npm install
```

### Configuration
Light Control uses [dotenv](https://github.com/motdotla/dotenv) for configuration. The following configuration properties should be set in a `.env` file in the same directory as `app.js`:
- URL - URL to the dashboard (including port if necessary, eg. mylightcontrol.com or mylightcontrol.com:4000)
- PORT - Port to use for the dashboard (4000 is used by default if this is not specified).
- MDS_HOST - URL to the mbed Device Server (mDS) instance/mbed Connector
- MDS_DOMAIN - Domain being used in mbed Device Server (mDS) instance/mbed Connector
- MDS_TOKEN - Token to use for mbed Connector authentication (not needed if using mDS basic auth)
- MDS_USERNAME - mDS basic auth username (not needed if using token authentication)
- MDS_PASSWORD - mDS basic auth password (not needed if using token authentication)

### Running the App

Start the server using the following command:

```
node app.js
```

Or leave it running continuously:

```
nohup node app.js &
```
