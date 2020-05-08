import React, { Component } from 'react'
import Video from './video';

class Videos extends Component {
  constructor(props) {
    super(props)

    this.state = {
      rVideos: [],
      remoteStreams: []
    }
  }

  componentWillReceiveProps(nextProps) {
    if (this.props.remoteStreams !== nextProps.remoteStreams) {

      let __rVideos = nextProps.remoteStreams.filter( (ele, ind) => ind === nextProps.remoteStreams.findIndex( elem => elem.id === ele.id));

      let _rVideos = __rVideos.map((rVideo, index) => {
        let video = <Video
          videoStream={rVideo.stream}
          frameStyle={{ width: 110, float: 'left', padding: '0 3px' }}
          videoStyles={{
            cursor: 'pointer',
            objectFit: 'cover',
            borderRadius: 3,
            width: '100%',
          }}
        />
        
        return (
          <div
            id={rVideo.name}
            onClick={() => this.props.switchVideo(rVideo)}
            style={{ display: 'inline-block' }}
            key={rVideo.id}
          >
            {video}
          </div>
        )
      })

      this.setState({
        remoteStreams: nextProps.remoteStreams,
        rVideos: _rVideos
      })
    }
  }

  render() {    
    return (
      <div>
        {
          this.state.rVideos && this.state.rVideos.length > 0 ?
            <div
              style={{
                zIndex: 3,
                position: 'fixed',
                padding: '6px 3px',
                backgroundColor: 'rgba(0,0,0,0.3)',
                maxHeight: 108,
                top: 'auto',
                right: 10,
                left: 10,
                bottom: 10,
                overflowX: 'scroll',
                whiteSpace: 'nowrap',
                width: '86%',
                minWidth: '86%',
              }}
            >
              {this.state.rVideos}
            </div>
            : null
        }
      </div>
    )
  }
}

export default Videos