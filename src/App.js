import '@fontsource/murecho';
import React, { useState, useEffect, useRef } from "react";
import WaveSurfer from "wavesurfer.js";
import RegionsPlugin from "wavesurfer.js/dist/plugins/regions.esm.js";
import "./App.css";

const API_URL = "https://audio-transcription-editor-13c6d97d2e6b.herokuapp.com";

function App() {
    const [file, setFile] = useState(null);
    const [transcription, setTranscription] = useState(null);
    const waveformRef = useRef(null);
    const wavesurfer = useRef(null);
    const [playing, setPlaying] = useState(false);
    const [editableWords, setEditableWords] = useState([]);
    const [showEditModal, setShowEditModal] = useState(false);
    const [currentWord, setCurrentWord] = useState(null);
    const [timeRange, setTimeRange] = useState({ start: 0, end: 0 });
    const [duration, setDuration] = useState(0);
    const [showQCWord, setShowQCWord] = useState(null);
    const [loadingMessage, setLoadingMessage] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const regionRef = useRef(null);

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
    };

    const uploadFile = async () => {
        if (!file) {
            alert("Please upload a file!");
            return;
        }
        setIsLoading(true);
        setLoadingMessage("Transcribing audio...");
        
        try {
            const formData = new FormData();
            formData.append("file", file);

            const response = await fetch(`${API_URL}/upload`, {
                method: "POST",
                body: formData,
            });
            
            const data = await response.json();
            setTranscription(data);
            
            setLoadingMessage("Audio transcribed successfully!");
            setTimeout(() => setIsLoading(false), 1000);
            
            initializeWaveform(URL.createObjectURL(file));
        } catch (error) {
            alert("Error uploading file");
            setIsLoading(false);
        }
    };

    const initializeWaveform = (audioUrl) => {
        if (wavesurfer.current) {
            wavesurfer.current.destroy();
        }
    
        wavesurfer.current = WaveSurfer.create({
            container: waveformRef.current,
            waveColor: "#4a4a4a",
            progressColor: "#2196F3",
            cursorColor: "red",
            backend: "WebAudio",
            height: 100,
            plugins: [RegionsPlugin.create()],
            interact: false,
        });
    
        const wsRegions = wavesurfer.current.registerPlugin(RegionsPlugin.create());
    
        wavesurfer.current.load(audioUrl);
    
        wavesurfer.current.on("ready", () => {
            const duration = wavesurfer.current.getDuration();
            setDuration(duration);
            setTimeRange({ start: 0, end: duration });
    
            const region = wsRegions.addRegion({
                start: 0.1,
                end: duration,
                content: "Selected Region",
                color: "rgba(0, 0, 0, 0.25)",
                drag: true,
                resize: true,
                minLength: 0.1,
                handleStyle: {
                    left: { backgroundColor: "red", width: "8px" },
                    right: { backgroundColor: "red", width: "8px" },
                },
            });
    
            regionRef.current = region;
    
            region.on("update-end", () => {
                setTimeRange({
                    start: region.start,
                    end: region.end,
                });
            });
    
            wsRegions.on("region-clicked", (region, e) => {
                e.stopPropagation();
                if (playing) {
                    region.pause();
                    setPlaying(false);
                } else {
                    region.play();
                    setPlaying(true);
                }
            });
    
            wavesurfer.current.on("finish", () => setPlaying(false));
        });
    };

    useEffect(() => {
        if (transcription) {
            const filtered = transcription.words.filter(
                (word) =>
                    (word.start_time / 1000 < timeRange.end) && 
                    (word.end_time / 1000 > timeRange.start)
            );
            setEditableWords(filtered);
        }
    }, [timeRange, transcription]);

    const togglePlay = () => {
        if (!wavesurfer.current || !regionRef.current) return;
    
        if (playing) {
            wavesurfer.current.pause();
            setPlaying(false);
        } else {
            regionRef.current.play();
            setPlaying(true);
        }
    };

    const openEditModal = (word) => {
      // Clear any existing selection first
      setCurrentWord(null);
      // Set new selection after brief delay to ensure DOM update
      setTimeout(() => {
          setCurrentWord(word);
          setShowQCWord(word.qc_word);
      }, 10);
  };

    const handleEditSubmit = (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        const updatedWord = {
            ...currentWord,
            word: formData.get("word"),
            start_time: Math.round(parseFloat(formData.get("start")) * 1000),
            end_time: Math.round(parseFloat(formData.get("end")) * 1000),
            edited: true,
           
        };

        const index = transcription.words.findIndex((w) => w === currentWord);
        let updatedWords = [...transcription.words];
        updatedWords[index] = updatedWord;
        setTranscription({ ...transcription, words: updatedWords });

        setCurrentWord(null);
    };

    const saveEdits = async () => {
        await fetch(`${API_URL}/update-json/${file.name}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(transcription),
        });
        alert("Edits Saved!");
    };

    const downloadJSON = async () => {
        try {
            const response = await fetch(`${API_URL}/download/${file.name}`);
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${file.name}_transcription.json`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        } catch (error) {
            alert("Error downloading JSON");
        }
    };

    return (
        <div className="app-container">
            <div className="top-bar">
                <h1 className="heading">Verbal Fluency Task</h1>
            </div>

            <div className="main-content">
                <div className="controls">
                <div className="upload-instructions">
                  <p>
                      Choose an audio file in one of these formats: 
                      <span className="format-list">
                           mp3, mp4, mpeg, mpga, m4a, wav, or webm
                      </span>. Use the audio waveform to replay sections and edit transcriptions 
                      with their corresponding timestamps as needed.
                  </p>
              </div>
            <div className="file-input-section">
                  <div className="file-input-container">
                      <input 
                          type="file" 
                          id="fileInput" 
                          onChange={handleFileChange} 
                          className="file-input"
                          accept=".mp3,.mp4,.mpeg,.mpga,.m4a,.wav,.webm"
                      />
                      <label htmlFor="fileInput" className="custom-file-upload">
                          Choose File
                      </label>
                      <span className="file-name">
                          {file ? file.name : "No file selected"}
                      </span>
                  </div>
                  <button className="primary-button" onClick={uploadFile}>
                      Upload & Transcribe
                  </button>
              </div>
          </div>
                {isLoading && (
                    <div className="loading-overlay">
                        <div className="loading-spinner"></div>
                        <p>{loadingMessage}</p>
                    </div>
                )}

                <div ref={waveformRef} className="waveform-container"></div>

                {transcription && (
                    <div className="time-controls">
                        <div className="slider-group">
                            <div className="input-group">
                                <label>Region Start (ms)</label>
                                <input
                                    type="number"
                                    value={Math.round(timeRange.start * 1000)}
                                    readOnly
                                />
                            </div>
                            <div className="input-group">
                                <label>Region End (ms)</label>
                                <input
                                    type="number"
                                    value={Math.round(timeRange.end * 1000)}
                                    readOnly
                                />
                            </div>
                            <button 
                                className="primary-button" 
                                onClick={togglePlay}
                            >
                                {playing ? "⏸ Pause" : "▶ Play Selection"}
                            </button>
                        </div>
                    </div>
                )}

                {transcription && (
                    <div className="transcription-container">
                        <div className="toolbar">
                            <button className="secondary-button" onClick={saveEdits}>
                                Save All Changes
                            </button>
                            <button className="secondary-button" onClick={downloadJSON}>
                                Download JSON
                            </button>
                        </div>

                        <div className="content-wrapper">
                            <div className="words-list">
                                {transcription.words.map((word, index) => (
                                    <div
                                    key={index}
                                    className={`word-item 
                                        ${editableWords.includes(word) ? "editable" : ""}
                                        ${currentWord?.word === word.word ? "selected" : ""}
                                        ${word.qc ? "qc-pass" : "qc-fail"}`
                                    }
                                >
                                        <div className="word-text">
                                            <div className="word-content">
                                                {word.word}
                                                {word.edited && (
                                                    <span className="edited-badge">(edited)</span>
                                                )}
                                            </div>
                                            <div className="metadata">
                                                <span className="timestamps">
                                                    {word.start_time}ms - {word.end_time}ms
                                                </span>
                                                <span 
                                                    className={`qc-status ${word.qc ? 'pass' : 'fail'}`}
                                                    /*onClick={() => setShowQCWord(word.qc_word)}*/
                                                >
                                                    {word.qc ? "✔ Correct" : "✗ Incorrect"}
                                                </span>
                                            </div>
                                        </div>
                                        
                                        {editableWords.includes(word) && (
                                            <button
                                                onClick={() => openEditModal(word)}
                                                className="edit-button"
                                            >
                                                Edit
                                            </button>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Edit Panel */}
                            <div className="static-panel edit-panel">
                                <h3>Edit Response</h3>
                                {currentWord ? (
                                    <form onSubmit={handleEditSubmit}>
                                        <div className="form-group">
                                            <label>Word:</label>
                                            <input
                                                name="word"
                                                defaultValue={currentWord.word}
                                                required
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label>Start (seconds):</label>
                                            <input
                                                name="start"
                                                type="number"
                                                step="0.001"
                                                defaultValue={currentWord.start_time / 1000}
                                                required
                                            />
                                        </div>

                                        <div className="form-group">
                                            <label>End (seconds):</label>
                                            <input
                                                name="end"
                                                type="number"
                                                step="0.001"
                                                defaultValue={currentWord.end_time / 1000}
                                                required
                                            />
                                        </div>

                                        <div className="modal-actions">
                                            <button type="submit" className="save-button">
                                                💾 Save
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => setCurrentWord(null)}
                                                className="cancel-button"
                                            >
                                                ✖ Cancel
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <p className="placeholder-text">No words chosen to edit</p>
                                )}
                            </div>

                            {/* QC Panel */}
                          <div className="static-panel qc-panel">
                              <h3>Quality Check Result</h3>
                              {currentWord ? (
                                  <>
                                      <p>{currentWord.qc_word || "No QC feedback available for this word"}</p>
                                      <button 
                                          onClick={() => setCurrentWord(null)} 
                                          className="cancel-button"
                                      >
                                          Close
                                      </button>
                                  </>
                              ) : (
                                  <p className="placeholder-text">
                                      Select a word to view quality check results
                                  </p>
                              )}
                          </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default App;