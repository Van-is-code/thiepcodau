import React, { useEffect, useRef, useState } from 'react'
import { api, API_BASE } from '../api'
import {
  IconMusic,
  IconX,
  IconPlus,
  IconTrash2,
  IconCheck,
  IconUploadCloud,
  IconMic,
  IconVolume2,
  IconVolumeX,
  IconPlay,
  IconPause,
  IconSquare,
} from './Icons'

function fileName(u) {
  try {
    return decodeURIComponent(String(u).split('/').pop().split('?')[0]) || 'Bản nhạc'
  } catch {
    return 'Bản nhạc'
  }
}

function audioSrc(u) {
  if (!u) return ''
  let full = String(u).trim()
  if (!/^https?:\/\//i.test(full)) {
    const base = API_BASE || (typeof window !== 'undefined' ? window.location.origin : '')
    full = base + (full.startsWith('/') ? full : '/' + full)
  }
  try {
    return encodeURI(decodeURI(full))
  } catch {
    return encodeURI(full)
  }
}

export default function MusicPanel({ invitation, onSaved, onClose, inline = false }) {
  const extra = invitation?.extra_data || {}
  const settings = extra?.music_settings || {}

  const initPlaylist = () => {
    const pl = extra?.music_playlist
    if (Array.isArray(pl) && pl.length) return pl.map((u) => ({ url: u, title: fileName(u) }))
    if (invitation?.music_url) return [{ url: invitation.music_url, title: fileName(invitation.music_url) }]
    return []
  }

  const [activeSubTab, setActiveSubTab] = useState('music') // 'music' | 'voice'
  const [list, setList] = useState(initPlaylist)
  const [musicVolume, setMusicVolume] = useState(settings?.music_volume ?? 80)
  const [voiceUrl, setVoiceUrl] = useState(settings?.voice_url || null)
  const [voiceVolume, setVoiceVolume] = useState(settings?.voice_volume ?? 100)
  const [duckMusic, setDuckMusic] = useState(settings?.duck_music ?? true)

  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [lib, setLib] = useState([])
  const [showLib, setShowLib] = useState(false)
  const [status, setStatus] = useState('idle')
  const [err, setErr] = useState('')
  const [dangTai, setDangTai] = useState(false)
  const [dangTaiVoice, setDangTaiVoice] = useState(false)

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false)
  const [recordSeconds, setRecordSeconds] = useState(0)
  const [recordedBlob, setRecordedBlob] = useState(null)
  const [recordedBlobUrl, setRecordedBlobUrl] = useState(null)
  const mediaRecorderRef = useRef(null)
  const audioChunksRef = useRef([])
  const timerRef = useRef(null)

  // Audio preview refs
  const fileRef = useRef(null)
  const voiceFileRef = useRef(null)
  const singleAudioRef = useRef(null)
  const [playingTrackUrl, setPlayingTrackUrl] = useState(null)

  // Duet preview (nghe thử cùng lúc cả 2)
  const duetMusicRef = useRef(null)
  const duetVoiceRef = useRef(null)
  const [isDuetPlaying, setIsDuetPlaying] = useState(false)

  useEffect(() => {
    api
      .listMusicLibrary()
      .then((r) => setLib(r.data?.data || r.data || []))
      .catch(() => {})
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopDuet()
      stopSinglePreview()
      if (timerRef.current) clearInterval(timerRef.current)
      if (recordedBlobUrl) URL.revokeObjectURL(recordedBlobUrl)
    }
  }, [recordedBlobUrl])

  // Stop single preview if playing
  const stopSinglePreview = () => {
    if (singleAudioRef.current) {
      try {
        singleAudioRef.current.pause()
        singleAudioRef.current.currentTime = 0
      } catch (_) {}
    }
    setPlayingTrackUrl(null)
  }

  const togglePreviewTrack = (url) => {
    stopDuet()
    if (playingTrackUrl === url) {
      stopSinglePreview()
      return
    }
    stopSinglePreview()

    const full = audioSrc(url)
    if (!full) return

    setErr('')
    const audio = new Audio(full)
    singleAudioRef.current = audio
    audio.volume = Math.max(0, Math.min(1, musicVolume / 100))

    audio.onended = () => {
      if (singleAudioRef.current === audio) {
        setPlayingTrackUrl(null)
      }
    }

    audio.onerror = () => {
      if (singleAudioRef.current === audio) {
        setPlayingTrackUrl(null)
        setErr('Không thể tải bài hát này. Hãy kiểm tra đường dẫn hoặc tải bài khác lên.')
      }
    }

    audio
      .play()
      .then(() => {
        if (singleAudioRef.current === audio) {
          setPlayingTrackUrl(url)
        }
      })
      .catch((e) => {
        if (singleAudioRef.current === audio) {
          setPlayingTrackUrl(null)
          setErr('Không phát được âm thanh: ' + (e.name === 'NotAllowedError' ? 'Trình duyệt đang chặn tự phát âm thanh. Vui lòng bấm nghe thử lại.' : e.message))
        }
      })
  }

  // Live Duet Preview
  const stopDuet = () => {
    if (duetMusicRef.current) {
      try {
        duetMusicRef.current.pause()
        duetMusicRef.current.currentTime = 0
      } catch (_) {}
    }
    if (duetVoiceRef.current) {
      try {
        duetVoiceRef.current.pause()
        duetVoiceRef.current.currentTime = 0
      } catch (_) {}
    }
    setIsDuetPlaying(false)
  }

  const toggleDuet = () => {
    stopSinglePreview()
    if (isDuetPlaying) {
      stopDuet()
      return
    }

    const musicToPlay = list[0]?.url ? audioSrc(list[0].url) : null
    const voiceToPlay = recordedBlobUrl || (voiceUrl ? audioSrc(voiceUrl) : null)

    if (!musicToPlay && !voiceToPlay) {
      setErr('Vui lòng chọn ít nhất 1 bài nhạc hoặc ghi âm để nghe thử!')
      return
    }

    setErr('')
    setIsDuetPlaying(true)

    if (musicToPlay) {
      const audio = new Audio(musicToPlay)
      duetMusicRef.current = audio
      audio.loop = true
      const initialVol = voiceToPlay && duckMusic ? (musicVolume / 100) * 0.25 : musicVolume / 100
      audio.volume = Math.max(0, Math.min(1, initialVol))
      audio.onerror = () => {
        setErr('Không tải được bài nhạc nền trong nghe thử kết hợp.')
      }
      audio.play().catch(() => {})
    }

    if (voiceToPlay) {
      const vAudio = new Audio(voiceToPlay)
      duetVoiceRef.current = vAudio
      vAudio.volume = Math.max(0, Math.min(1, voiceVolume / 100))
      vAudio.onerror = () => {
        setErr('Không tải được file ghi âm trong nghe thử kết hợp.')
      }
      vAudio.onended = () => {
        if (duetMusicRef.current) {
          duetMusicRef.current.volume = Math.max(0, Math.min(1, musicVolume / 100))
        }
        if (!musicToPlay) setIsDuetPlaying(false)
      }
      vAudio.play().catch(() => {})
    }
  }

  // Update volumes in real time when slider changes during preview
  const handleMusicVolumeChange = (newVol) => {
    setMusicVolume(newVol)
    if (singleAudioRef.current && playingTrackUrl) {
      singleAudioRef.current.volume = newVol / 100
    }
    if (duetMusicRef.current && isDuetPlaying) {
      const isVoicePlaying = duetVoiceRef.current && !duetVoiceRef.current.paused
      const target = isVoicePlaying && duckMusic ? (newVol / 100) * 0.25 : newVol / 100
      duetMusicRef.current.volume = Math.max(0, Math.min(1, target))
    }
  }

  const handleVoiceVolumeChange = (newVol) => {
    setVoiceVolume(newVol)
    if (duetVoiceRef.current && isDuetPlaying) {
      duetVoiceRef.current.volume = newVol / 100
    }
  }

  const add = (url, title) => {
    url = String(url || '').trim()
    if (!/^(https?:\/\/|\/media\/|\/uploads\/)/i.test(url)) {
      setErr('Link nhạc phải bắt đầu bằng http(s):// hoặc /media/')
      return
    }
    if (list.some((x) => x.url === url)) return
    setErr('')
    setList((l) => [...l, { url, title: title || fileName(url) }])
  }

  const taiNhacRieng = async (file) => {
    if (!file) return
    setDangTai(true)
    setErr('')
    try {
      const r = await api.uploadOwnMusic(invitation.id, file)
      const d = r.data?.data || r.data
      const url = d?.music_url || d?.url
      if (!url) throw new Error('Máy chủ không trả về đường dẫn nhạc')
      add(url, file.name.replace(/\.[^.]+$/, ''))
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Tải nhạc lên thất bại')
    } finally {
      setDangTai(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  // Tải file ghi âm có sẵn từ máy
  const taiVoiceFile = async (file) => {
    if (!file) return
    setDangTaiVoice(true)
    setErr('')
    try {
      const r = await api.uploadOwnMusic(invitation.id, file)
      const d = r.data?.data || r.data
      const url = d?.music_url || d?.url
      if (!url) throw new Error('Máy chủ không trả về đường dẫn file ghi âm')
      setVoiceUrl(url)
      setRecordedBlob(null)
      if (recordedBlobUrl) {
        URL.revokeObjectURL(recordedBlobUrl)
        setRecordedBlobUrl(null)
      }
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Tải file ghi âm thất bại')
    } finally {
      setDangTaiVoice(false)
      if (voiceFileRef.current) voiceFileRef.current.value = ''
    }
  }

  // Microphone recording
  const startRecording = async () => {
    stopDuet()
    stopSinglePreview()
    setErr('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      const mime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : ''
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream)

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
        const type = recorder.mimeType || 'audio/webm'
        const blob = new Blob(audioChunksRef.current, { type })
        setRecordedBlob(blob)
        if (recordedBlobUrl) URL.revokeObjectURL(recordedBlobUrl)
        const newUrl = URL.createObjectURL(blob)
        setRecordedBlobUrl(newUrl)
      }

      recorder.start(100)
      mediaRecorderRef.current = recorder
      setIsRecording(true)
      setRecordSeconds(0)

      timerRef.current = setInterval(() => {
        setRecordSeconds((s) => s + 1)
      }, 1000)
    } catch (e) {
      setErr('Không thể mở micro: ' + (e.message || 'Vui lòng cấp quyền micro trên trình duyệt'))
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      if (timerRef.current) clearInterval(timerRef.current)
    }
    setRecordedBlob(null)
    if (recordedBlobUrl) {
      URL.revokeObjectURL(recordedBlobUrl)
      setRecordedBlobUrl(null)
    }
  }

  // Tải bản ghi âm vừa thu lên máy chủ
  const uploadRecordedVoice = async () => {
    if (!recordedBlob) return
    setDangTaiVoice(true)
    setErr('')
    try {
      const ext = recordedBlob.type.includes('ogg') ? 'ogg' : 'webm'
      const file = new File([recordedBlob], `ghi-am-${Date.now()}.${ext}`, { type: recordedBlob.type })
      const r = await api.uploadOwnMusic(invitation.id, file)
      const d = r.data?.data || r.data
      const url = d?.music_url || d?.url
      if (!url) throw new Error('Máy chủ không trả về đường dẫn file ghi âm')
      setVoiceUrl(url)
      setRecordedBlob(null)
      if (recordedBlobUrl) {
        URL.revokeObjectURL(recordedBlobUrl)
        setRecordedBlobUrl(null)
      }
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Lưu bản ghi âm thất bại')
    } finally {
      setDangTaiVoice(false)
    }
  }

  const removeVoice = () => {
    setVoiceUrl(null)
    setRecordedBlob(null)
    if (recordedBlobUrl) {
      URL.revokeObjectURL(recordedBlobUrl)
      setRecordedBlobUrl(null)
    }
    stopDuet()
  }

  const formatSec = (s) => {
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m < 10 ? '0' : ''}${m}:${sec < 10 ? '0' : ''}${sec}`
  }

  const save = async () => {
    // If there is an unsaved recorded blob, upload it first
    let finalVoiceUrl = voiceUrl
    if (recordedBlob && !voiceUrl) {
      try {
        setDangTaiVoice(true)
        const ext = recordedBlob.type.includes('ogg') ? 'ogg' : 'webm'
        const file = new File([recordedBlob], `ghi-am-${Date.now()}.${ext}`, { type: recordedBlob.type })
        const r = await api.uploadOwnMusic(invitation.id, file)
        const d = r.data?.data || r.data
        finalVoiceUrl = d?.music_url || d?.url
        setVoiceUrl(finalVoiceUrl)
      } catch (e) {
        setErr('Lưu file ghi âm thất bại: ' + e.message)
        setDangTaiVoice(false)
        return
      } finally {
        setDangTaiVoice(false)
      }
    }

    setStatus('saving')
    setErr('')
    try {
      const payload = {
        music_playlist: list.map((x) => x.url),
        music_volume: Number(musicVolume),
        voice_url: finalVoiceUrl || null,
        voice_volume: Number(voiceVolume),
        duck_music: Boolean(duckMusic),
      }
      const res = await api.setInvitationMusic(invitation.id, payload)
      const data = res.data?.data || res.data
      setStatus('saved')
      onSaved && onSaved(data)
      setTimeout(() => setStatus('idle'), 3000)
    } catch (e) {
      setErr(e?.response?.data?.message || e.message || 'Lưu cài đặt âm thanh thất bại')
      setStatus('error')
    }
  }

  const content = (
    <div style={inline ? S.inlineWrapper : S.box}>
      {/* Header (modal only) */}
      {!inline && (
        <div style={S.head}>
          <div>
            <div style={S.title}>
              <IconMusic size={18} color="#d97757" /> Cài đặt Âm Thanh & Nhạc Nền
            </div>
            <div style={S.sub}>
              Chọn nhạc nền từ kho hoặc tải nhạc riêng, tự ghi âm lời chúc và tinh chỉnh âm lượng theo ý thích.
            </div>
          </div>
          {onClose && (
            <button style={S.close} onClick={onClose}>
              <IconX size={18} />
            </button>
          )}
        </div>
      )}

      {/* Navigation Subtabs */}
      <div style={S.subTabNav}>
        <button
          style={{
            ...S.subTabBtn,
            ...(activeSubTab === 'music' ? S.subTabBtnActive : {}),
          }}
          onClick={() => setActiveSubTab('music')}
        >
          <IconMusic size={15} />
          <span>1. Nhạc Nền ({list.length})</span>
        </button>

        <button
          style={{
            ...S.subTabBtn,
            ...(activeSubTab === 'voice' ? S.subTabBtnActive : {}),
          }}
          onClick={() => setActiveSubTab('voice')}
        >
          <IconMic size={15} />
          <span>2. Ghi Âm Lời Chúc {voiceUrl || recordedBlob ? '●' : ''}</span>
        </button>
      </div>

      <div style={S.body}>
        {/* --- TAB 1: NHẠC NỀN --- */}
        {activeSubTab === 'music' && (
          <div>
            {/* Music volume slider */}
            <div style={S.volumeControlCard}>
              <div style={S.volumeHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {musicVolume === 0 ? <IconVolumeX size={16} color="#9e918a" /> : <IconVolume2 size={16} color="#d97757" />}
                  <span style={S.volumeLabel}>Âm lượng Nhạc Nền</span>
                </div>
                <span style={S.volumeValue}>{musicVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={musicVolume}
                onChange={(e) => handleMusicVolumeChange(Number(e.target.value))}
                style={S.slider}
              />
            </div>

            {/* Playlist */}
            <div style={{ marginTop: 16 }}>
              <div style={S.sectionHeading}>Danh sách bài hát đã chọn</div>
              {list.length === 0 && (
                <div style={S.empty}>Chưa có bài hát nào — hệ thống sẽ tự phát 1 bài ngẫu nhiên từ kho nhạc cưới.</div>
              )}

              {list.map((t, i) => (
                <div key={t.url + i} style={S.track}>
                  <span style={S.trackIdx}>{i + 1}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={S.trackTitle}>{t.title}</div>
                    <div style={S.trackUrl}>{t.url}</div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      style={{
                        ...S.btnIcon,
                        background: playingTrackUrl === t.url ? '#fdebe7' : '#f6f1eb',
                        color: playingTrackUrl === t.url ? '#d97757' : '#554740',
                      }}
                      onClick={() => togglePreviewTrack(t.url)}
                      title={playingTrackUrl === t.url ? 'Dừng nghe thử' : 'Nghe thử'}
                    >
                      {playingTrackUrl === t.url ? <IconSquare size={13} /> : <IconPlay size={13} />}
                    </button>

                    <button
                      style={S.trackDel}
                      onClick={() => {
                        if (playingTrackUrl === t.url) stopSinglePreview()
                        setList((l) => l.filter((_, idx) => idx !== i))
                      }}
                      title="Xoá bài này"
                    >
                      <IconTrash2 size={13} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add music options */}
            <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px dashed #ede5db' }}>
              <div style={S.sectionHeading}>Thêm nhạc vào thiệp</div>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 8 }}>
                {/* Upload own music */}
                <input
                  ref={fileRef}
                  type="file"
                  style={{ display: 'none' }}
                  accept="audio/*,.mp3,.wav,.ogg,.m4a,.flac,.webm"
                  onChange={(e) => taiNhacRieng(e.target.files?.[0] || null)}
                />
                <button style={S.btnAddPrimary} onClick={() => fileRef.current?.click()} disabled={dangTai}>
                  <IconUploadCloud size={15} /> {dangTai ? 'Đang tải lên…' : 'Tải file nhạc từ thiết bị'}
                </button>

                {/* System library toggle */}
                <button style={S.btnSecondary} onClick={() => setShowLib((v) => !v)}>
                  <IconMusic size={14} /> {showLib ? 'Đóng kho nhạc' : `Kho nhạc hệ thống (${lib.length})`}
                </button>
              </div>

              {/* Paste URL */}
              <div style={{ ...S.addRow, marginTop: 10 }}>
                <input
                  style={S.input}
                  placeholder="Hoặc dán trực tiếp link bài hát online (mp3)..."
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                />
                <input
                  style={{ ...S.input, width: 130 }}
                  placeholder="Tên bài (tuỳ chọn)"
                  value={linkTitle}
                  onChange={(e) => setLinkTitle(e.target.value)}
                />
                <button
                  style={S.btnSmallAdd}
                  onClick={() => {
                    add(linkUrl, linkTitle)
                    setLinkUrl('')
                    setLinkTitle('')
                  }}
                >
                  <IconPlus size={14} /> Thêm
                </button>
              </div>

              {/* System library picker */}
              {showLib && (
                <div style={S.libBox}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: '#554740', marginBottom: 6 }}>
                    Chọn bài hát mẫu dành riêng cho lễ cưới:
                  </div>
                  {lib.length === 0 && (
                    <div style={S.empty}>Kho nhạc hệ thống hiện chưa có bài. Bạn có thể tự tải nhạc lên ở trên.</div>
                  )}
                  {lib.map((t) => (
                    <div key={t.id} style={S.libRow}>
                      <button
                        style={{
                          ...S.btnIcon,
                          background: playingTrackUrl === t.url ? '#fdebe7' : '#f6f1eb',
                          color: playingTrackUrl === t.url ? '#d97757' : '#554740',
                        }}
                        onClick={() => togglePreviewTrack(t.url)}
                      >
                        {playingTrackUrl === t.url ? <IconSquare size={12} /> : <IconPlay size={12} />}
                      </button>
                      <span style={{ flex: 1, fontSize: 12.5, color: '#1f1917', fontWeight: 500 }}>{t.title}</span>
                      <button style={S.btnPick} onClick={() => add(t.url, t.title)}>
                        + Chọn bài này
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* --- TAB 2: GHI ÂM LỜI CHÚC --- */}
        {activeSubTab === 'voice' && (
          <div>
            <div style={S.noticeCard}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#8c4e36', marginBottom: 4 }}>
                🎙️ Lời nhắn & Lời chúc ấm áp từ Cô Dâu - Chú Rể
              </div>
              <div style={{ fontSize: 12, color: '#6e5a52', lineHeight: 1.5 }}>
                Bạn có thể tự ghi âm giọng nói trực tiếp qua micro hoặc tải lên file thu âm. Khi khách mở thiệp, giọng nói của bạn
                sẽ phát kèm nhạc nền đầy cảm xúc!
              </div>
            </div>

            {/* Voice volume slider */}
            <div style={{ ...S.volumeControlCard, marginTop: 14 }}>
              <div style={S.volumeHeader}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {voiceVolume === 0 ? <IconVolumeX size={16} color="#9e918a" /> : <IconVolume2 size={16} color="#d97757" />}
                  <span style={S.volumeLabel}>Âm lượng Lời Ghi Âm</span>
                </div>
                <span style={S.volumeValue}>{voiceVolume}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={voiceVolume}
                onChange={(e) => handleVoiceVolumeChange(Number(e.target.value))}
                style={S.slider}
              />
            </div>

            {/* Audio Ducking Checkbox */}
            <label style={S.checkLabel}>
              <input
                type="checkbox"
                checked={duckMusic}
                onChange={(e) => setDuckMusic(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: '#d97757' }}
              />
              <span style={{ fontSize: 12.5, color: '#382f2c' }}>
                <strong>Tự động giảm nhỏ nhạc nền</strong> khi đang phát giọng ghi âm (để lời chúc nghe rõ ràng, không bị át tiếng)
              </span>
            </label>

            {/* Current Voice Audio (Saved or Recorded) */}
            {(voiceUrl || recordedBlob) && (
              <div style={S.voiceCard}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                  <div style={S.micIconBadge}>
                    <IconMic size={18} color="#d97757" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#1f1917' }}>
                      {voiceUrl ? 'Bản ghi âm đã gắn vào thiệp' : 'Bản ghi âm mới (chưa lưu)'}
                    </div>
                    <div style={{ fontSize: 11.5, color: '#8c7d75', marginTop: 2 }}>
                      {voiceUrl ? voiceUrl : `Độ dài ~${formatSec(recordSeconds)} (bấm Lưu ở dưới để hoàn tất)`}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {/* Preview voice */}
                  <button
                    style={S.btnVoiceAction}
                    onClick={() => {
                      const vUrl = recordedBlobUrl || audioSrc(voiceUrl)
                      togglePreviewTrack(vUrl)
                    }}
                    title="Nghe thử bản ghi"
                  >
                    <IconPlay size={13} /> Nghe thử
                  </button>

                  {/* Delete voice */}
                  <button style={S.trackDel} onClick={removeVoice} title="Xoá bản ghi âm">
                    <IconTrash2 size={13} />
                  </button>
                </div>
              </div>
            )}

            {/* Recording Controls */}
            <div style={{ marginTop: 18, padding: '16px 14px', background: '#faf6f2', borderRadius: 14, border: '1px dashed #e3d5c5' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: '#2b2320', marginBottom: 10 }}>
                {voiceUrl || recordedBlob ? 'Ghi âm lại bản mới:' : 'Bắt đầu ghi âm lời chúc:'}
              </div>

              {!isRecording ? (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                  <button style={S.btnRecordStart} onClick={startRecording} disabled={dangTaiVoice}>
                    <IconMic size={16} /> Bấm để bắt đầu thu âm
                  </button>

                  <span style={{ fontSize: 12, color: '#8c7d75' }}>hoặc</span>

                  <input
                    ref={voiceFileRef}
                    type="file"
                    style={{ display: 'none' }}
                    accept="audio/*,.mp3,.wav,.ogg,.m4a,.webm"
                    onChange={(e) => taiVoiceFile(e.target.files?.[0] || null)}
                  />
                  <button style={S.btnSecondary} onClick={() => voiceFileRef.current?.click()} disabled={dangTaiVoice}>
                    <IconUploadCloud size={14} /> {dangTaiVoice ? 'Đang tải…' : 'Tải file ghi âm có sẵn'}
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={S.recordingPulse} />
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#b5443a' }}>
                      Đang ghi âm: {formatSec(recordSeconds)}
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button style={S.btnRecordStop} onClick={stopRecording}>
                      <IconSquare size={14} /> Xong & Dừng
                    </button>
                    <button style={S.btnSecondary} onClick={cancelRecording}>
                      Huỷ
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {err && <div style={S.err}>⚠ {err}</div>}
      </div>

      {/* Footer Actions: Live Duet Preview + Save Button */}
      <div style={S.actions}>
        {/* Duet Preview button */}
        <button
          style={{
            ...S.btnDuet,
            background: isDuetPlaying ? '#fdebe7' : '#f6efe9',
            color: isDuetPlaying ? '#b5443a' : '#554740',
            borderColor: isDuetPlaying ? '#e3b7b1' : '#e0d4c7',
          }}
          onClick={toggleDuet}
          title="Nghe thử kết hợp cả nhạc nền và lời ghi âm theo âm lượng đã chọn"
        >
          {isDuetPlaying ? <IconSquare size={14} /> : <IconPlay size={14} />}
          <span>{isDuetPlaying ? 'Dừng nghe thử' : '▶ Nghe thử kết hợp cả 2'}</span>
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: status === 'saved' ? '#4f7e65' : '#8c7d75' }}>
            {status === 'saved' ? '✓ Đã lưu âm thanh!' : status === 'saving' ? 'Đang lưu…' : ''}
          </span>

          <button style={S.btnMain} onClick={save} disabled={status === 'saving' || isRecording}>
            <IconCheck size={16} /> Lưu Cài Đặt Âm Thanh
          </button>
        </div>
      </div>
    </div>
  )

  if (inline) {
    return content
  }

  return (
    <div style={S.overlay} onClick={(e) => e.target === e.currentTarget && onClose && onClose()}>
      {content}
    </div>
  )
}

const S = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(25, 20, 18, 0.65)',
    backdropFilter: 'blur(5px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    zIndex: 9500,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  box: {
    width: 'min(580px, 100%)',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    background: '#ffffff',
    borderRadius: 20,
    overflow: 'hidden',
    boxShadow: '0 28px 70px rgba(0, 0, 0, 0.28)',
    border: '1px solid #ede5db',
  },
  inlineWrapper: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    background: '#ffffff',
    borderRadius: 16,
    border: '1px solid #ede5db',
    overflow: 'hidden',
    boxShadow: '0 4px 16px rgba(0, 0, 0, 0.04)',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  head: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
    padding: '20px 24px 14px',
    borderBottom: '1px solid #ede5db',
  },
  title: {
    fontSize: 16.5,
    fontWeight: 700,
    color: '#1f1917',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  sub: {
    fontSize: 12,
    color: '#7a6c65',
    marginTop: 4,
    lineHeight: 1.5,
  },
  close: {
    background: '#f6f1eb',
    border: '1px solid #ede5db',
    borderRadius: 10,
    padding: 7,
    cursor: 'pointer',
    color: '#6e625c',
    display: 'flex',
    flexShrink: 0,
  },
  subTabNav: {
    display: 'flex',
    background: '#faf6f2',
    padding: '6px 14px',
    gap: 8,
    borderBottom: '1px solid #ede5db',
  },
  subTabBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    borderRadius: 10,
    border: 'none',
    background: 'none',
    fontSize: 13,
    fontWeight: 600,
    color: '#6e625c',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  subTabBtnActive: {
    background: '#ffffff',
    color: '#d97757',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.06)',
    fontWeight: 700,
  },
  body: {
    padding: '18px 22px',
    overflowY: 'auto',
    flex: 1,
    maxHeight: '62vh',
  },
  volumeControlCard: {
    background: '#fbf8f5',
    border: '1px solid #eedecf',
    borderRadius: 12,
    padding: '12px 16px',
  },
  volumeHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  volumeLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: '#342925',
  },
  volumeValue: {
    fontSize: 13,
    fontWeight: 700,
    color: '#d97757',
  },
  slider: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    accentColor: '#d97757',
    cursor: 'pointer',
  },
  sectionHeading: {
    fontSize: 12.5,
    fontWeight: 700,
    color: '#382f2c',
    marginBottom: 8,
  },
  empty: {
    fontSize: 12,
    color: '#8c7d75',
    padding: '12px 14px',
    fontStyle: 'italic',
    background: '#fbf8f5',
    borderRadius: 10,
    textAlign: 'center',
  },
  track: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 12px',
    borderRadius: 10,
    background: '#fdfbf9',
    border: '1px solid #f0e6dc',
    marginTop: 6,
  },
  trackIdx: {
    width: 22,
    height: 22,
    borderRadius: 6,
    background: '#f4ede6',
    color: '#8c7d75',
    fontSize: 11,
    fontWeight: 700,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  trackTitle: {
    fontSize: 13,
    color: '#1f1917',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
  },
  trackUrl: {
    fontSize: 10.5,
    color: '#9e918a',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    marginTop: 1,
  },
  btnIcon: {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  trackDel: {
    width: 28,
    height: 28,
    background: '#fbeeec',
    border: '1px solid #e3b7b1',
    borderRadius: 8,
    padding: 0,
    cursor: 'pointer',
    color: '#b5443a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  addRow: {
    display: 'flex',
    gap: 8,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    minWidth: 120,
    height: 36,
    padding: '0 12px',
    border: '1px solid #d8ccbe',
    borderRadius: 8,
    fontSize: 12.5,
    background: '#fcfaf7',
    color: '#1f1917',
  },
  btnAddPrimary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 16px',
    height: 36,
    fontSize: 12.5,
    fontWeight: 600,
    borderRadius: 9,
    border: 'none',
    background: '#d97757',
    color: '#fff',
    cursor: 'pointer',
    boxShadow: '0 2px 6px rgba(217, 119, 87, 0.25)',
  },
  btnSecondary: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 14px',
    height: 36,
    fontSize: 12.5,
    fontWeight: 600,
    borderRadius: 9,
    border: '1px solid #ede5db',
    background: '#ffffff',
    color: '#4a3d38',
    cursor: 'pointer',
  },
  btnSmallAdd: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '0 14px',
    height: 36,
    fontSize: 12.5,
    fontWeight: 600,
    borderRadius: 8,
    border: '1px solid #ede5db',
    background: '#f6f1eb',
    color: '#1f1917',
    cursor: 'pointer',
  },
  libBox: {
    marginTop: 12,
    padding: 12,
    background: '#f9f6f2',
    borderRadius: 12,
    border: '1px solid #eedfcfa0',
    maxHeight: 200,
    overflowY: 'auto',
  },
  libRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 8px',
    borderRadius: 8,
    background: '#fff',
    border: '1px solid #f0e6dc',
    marginTop: 5,
  },
  btnPick: {
    background: '#fdebe7',
    border: 'none',
    borderRadius: 6,
    color: '#c96547',
    fontSize: 11.5,
    fontWeight: 600,
    padding: '5px 10px',
    cursor: 'pointer',
  },
  noticeCard: {
    background: '#fdf5f0',
    border: '1px solid #f2dbcb',
    borderRadius: 12,
    padding: '12px 16px',
  },
  checkLabel: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 9,
    marginTop: 12,
    cursor: 'pointer',
    background: '#fdfbf9',
    padding: '10px 12px',
    borderRadius: 10,
    border: '1px solid #f0e6dc',
  },
  voiceCard: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    padding: '12px 14px',
    borderRadius: 12,
    background: '#ffffff',
    border: '1px solid #e3d5c5',
    marginTop: 12,
    boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
  },
  micIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 10,
    background: '#fdebe7',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  btnVoiceAction: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '6px 12px',
    borderRadius: 8,
    border: '1px solid #ede5db',
    background: '#fbf8f5',
    color: '#4a3d38',
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
  },
  btnRecordStart: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 16px',
    borderRadius: 10,
    border: 'none',
    background: '#b5443a',
    color: '#fff',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(181, 68, 58, 0.25)',
  },
  btnRecordStop: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 9,
    border: 'none',
    background: '#2b2320',
    color: '#fff',
    fontSize: 12.5,
    fontWeight: 600,
    cursor: 'pointer',
  },
  recordingPulse: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    background: '#b5443a',
    display: 'inline-block',
    animation: 'pulse 1s infinite',
  },
  err: {
    marginTop: 12,
    fontSize: 12,
    color: '#b5443a',
    background: '#fef2f2',
    padding: '8px 12px',
    borderRadius: 8,
  },
  actions: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    padding: '14px 22px 18px',
    borderTop: '1px solid #ede5db',
    background: '#fdfbf9',
    flexWrap: 'wrap',
  },
  btnDuet: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    fontSize: 12.5,
    fontWeight: 600,
    borderRadius: 9,
    border: '1px solid',
    cursor: 'pointer',
    transition: 'all 0.15s ease',
  },
  btnMain: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '9px 20px',
    fontSize: 13,
    fontWeight: 700,
    borderRadius: 9,
    border: 'none',
    background: 'linear-gradient(135deg, #e58d6f 0%, #c96547 100%)',
    color: '#ffffff',
    cursor: 'pointer',
    boxShadow: '0 4px 12px rgba(201, 101, 71, 0.25)',
  },
}
