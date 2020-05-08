import React, { Component } from 'react';

import io from 'socket.io-client'

import Video from './../components/video';
import Videos from './../components/videos'

class JoinChat extends Component {
    constructor(props) {
        super(props);       

        this.state = {
            localStream: null,
            remoteStream: null,
            remoteStreams: [],
            peerConnections: {},
            selectedVideo: null,
            status: 'Please wait...',
            pc_config: {
                "iceServers": [
                    {
                        urls: 'stun:stun.l.google.com:19302'
                    }
                ]
            },

            sdpConstraints: {
                'mandatory': {
                    'OfferToReceiveAudio': true,
                    'OfferToReceiveVideo': true
                }
            },
        }

        this.serviceIP = 'https://3a1f58c7.ngrok.io/webrtcPeer';
        this.callStatus = '';
        this.socket = null;
    }

    getLocalStream = () => {
        const success = (stream) => {
            window.localStream = stream
            this.setState({
                localStream: stream
            })
            this.whoisOnline();
        }

        // called when getUserMedia() fails - see below
        const failure = (e) => {
            console.log('getUserMedia Error: ', e)
        }

        const constraints = {
            audio: true,
            video: true,
            options: {
                mirror: true,
            }
        }

        navigator.mediaDevices.getUserMedia(constraints)
            .then(success)
            .catch(failure)
    }

    whoisOnline = () => {
        this.sendToPeer('onlinePeers', null, { local: this.socket.id })
    }

    sendToPeer = (messageType, payload, socketID) => {
        this.socket.emit(messageType, {
            socketID,
            payload
        })
    }

    createPeerConnection = (socketID, callback) => {
        try {
            let pc = new RTCPeerConnection(this.state.pc_config)

            // add pc to peerConnections object
            const peerConnections = { ...this.state.peerConnections, [socketID]: pc }
            this.setState({
                peerConnections
            })

            pc.onicecandidate = (e) => {
                if (e.candidate) {
                    this.sendToPeer('candidate', e.candidate, {
                        local: this.socket.id,
                        remote: socketID
                    })
                }
            }

            pc.ontrack = (e) => {
                const remoteVideo = {
                    id: socketID,
                    name: socketID,
                    stream: e.streams[0]
                }

                this.setState(prevState => {
                    // If we already have a stream in display let it stay the same, otherwise use the latest stream
                    const remoteStream = prevState.remoteStreams.length > 0 ? {} : { remoteStream: e.streams[0] }

                    // get currently selected video
                    let selectedVideo = prevState.remoteStreams.filter(stream => stream.id === prevState.selectedVideo.id)
                    // if the video is still in the list, then do nothing, otherwise set to new video stream
                    selectedVideo = selectedVideo.length ? {} : { selectedVideo: remoteVideo }

                    return {
                        ...selectedVideo,
                        ...remoteStream,
                        remoteStreams: [...prevState.remoteStreams, remoteVideo]
                    }
                })
            }

            pc.close = () => {
                // alert('GONE')
            }

            if (this.state.localStream)
                pc.addStream(this.state.localStream)

            // return pc
            callback(pc)

        } catch (e) {
            console.log('Something went wrong! pc not created!!', e);
            callback(null);
        }
    }

    componentDidMount = () => {        
        this.socket = io.connect(
            this.serviceIP,
            {
                path: '/io/webrtc',
                query: {
                    room: window.location.pathname, //this.props.roomName,
                }
            }
        );

        this.socket.on('connection-success', data => {
            console.log('connection-success');
            this.getLocalStream();
            const status = data.peerCount > 1 ? `Total users ${data.peerCount}` : 'Waiting for other to connect';
            this.setState({
                status: status
            })
        });

        this.socket.on('joined-peers', data => {
            console.log('joined-peers');
            this.setState({
                status: data.peerCount > 1 ? `Total users ${data.peerCount}` : 'Waiting for other to connect'
            })
        });

        this.socket.on('peer-disconnected', data => {
            console.log('peer-disconnected');
            const remoteStreams = this.state.remoteStreams.filter(stream => stream.id !== data.socketID);
            this.setState(prevState => {
                // check if disconnected peer is the selected video and if there still connected peers, then select the first
                const selectedVideo = prevState.selectedVideo.id === data.socketID && remoteStreams.length ? { selectedVideo: remoteStreams[0] } : null

                return {
                    remoteStreams,
                    ...selectedVideo,
                    status: data.peerCount > 1 ? `Total users ${data.peerCount}` : 'Waiting for other connect'
                }
            }
            )
        });

        this.socket.on('online-peer', socketID => {
            console.log('online-peer');
            // 1. Create new pc
            this.createPeerConnection(socketID, pc => {
                // 2. Create Offer
                if (pc)
                    pc.createOffer(this.state.sdpConstraints)
                        .then(sdp => {
                            pc.setLocalDescription(sdp)

                            this.sendToPeer('offer', sdp, {
                                local: this.socket.id,
                                remote: socketID
                            })
                        })
            })
        })

        this.socket.on('offer', data => {
            console.log('offer');
            this.createPeerConnection(data.socketID, pc => {
                pc.addStream(this.state.localStream)

                pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(() => {
                    // 2. Create Answer
                    pc.createAnswer(this.state.sdpConstraints)
                        .then(sdp => {
                            pc.setLocalDescription(sdp)

                            this.sendToPeer('answer', sdp, {
                                local: this.socket.id,
                                remote: data.socketID
                            })
                        })
                })
            })
        })

        this.socket.on('answer', data => {
            console.log('answer');
            const pc = this.state.peerConnections[data.socketID];
            pc.setRemoteDescription(new RTCSessionDescription(data.sdp)).then(() => { })
        })

        this.socket.on('candidate', (data) => {
            console.log('candidate');
            const pc = this.state.peerConnections[data.socketID];
            if (pc)
                pc.addIceCandidate(new RTCIceCandidate(data.candidate))
        })
    }

    switchVideo = (_video) => {
        this.setState({
            selectedVideo: _video
        })
    }

    handleJoinClick = (e) => {
        this.callStatus = this.callStatus === 'Joined' ? '' : 'Joined';
    }

    render() {
        const statusText = <div style={{ color: 'yellow', padding: 5 }}>{this.state.status}</div>

        return (
            <div>               
                <div style={{
                    zIndex: 2,
                    position: 'absolute',
                    right: 0,
                    width: 150,
                    height: 150,
                    margin: 5,
                    textAlign: 'center',
                }}>
                    <h3 style={{
                        backgroundColor: 'aqua',
                        border: '2px solid mediumaquamarine',
                        borderRadius: '5px',
                        float: 'left',
                        width: '100%',
                    }}>
                        Room: {" "}
                        {this.props.roomName}
                    </h3>
                    <Video
                        videoStyles={{
                            right: 0,
                            width: 150,
                            height: 150,
                            borderRadius: '10%',
                            backgroundColor: 'black'
                        }}
                        videoStream={this.state.localStream}
                        autoPlay muted>
                    </Video>

                    <div style={{
                        margin: 10,
                        backgroundColor: 'blue',
                        padding: 10,
                        borderRadius: 5,
                    }}>
                        {statusText}
                    </div>

                    {/* <button onClick={this.handleJoinClick}>
                        Join
                </button> */}

                </div>
                <div style={this.state.remoteStreams && this.state.remoteStreams.length > 0 ? {
                    zIndex: 1,
                    position: 'fixed',
                    bottom: 0,
                    width: '88%',
                    minWidth: '88%',
                    backgroundColor: 'black',
                    minHeight: '79%',
                    height: '79%',
                    borderRadius: '10px',
                    top: 0,
                    overflow: 'hidden',
                } : {
                        zIndex: 1,
                        position: 'fixed',
                        bottom: 0,
                        width: '88%',
                        minWidth: '88%',
                        backgroundColor: 'black',
                        minHeight: '100%',
                        height: '100%',
                        borderRadius: '10px',
                        top: 0,
                        overflow: 'hidden',
                    }}>
                    <Video
                        videoStyles={{
                            position: 'absolute',
                            bottom: 0,
                            width: '100%',
                            minWidth: '100%',
                            minHeight: '100%',
                            backgroundColor: 'black',
                            top: 0,
                        }}
                        videoStream={this.state.selectedVideo && this.state.selectedVideo.stream}
                        autoPlay>
                    </Video>
                </div>
                <div>
                    <Videos
                        switchVideo={this.switchVideo}
                        remoteStreams={this.state.remoteStreams}
                    ></Videos>
                </div>
            </div>
        )
    }
}

export default JoinChat;