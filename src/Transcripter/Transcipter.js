import React, { useState, useEffect } from 'react';
import Groq from 'groq-sdk';
import { Oval } from "react-loader-spinner";

const Transcipter = () => {
    const [time, setTime] = useState(0);
    const [para, setPara] = useState('');
    const [currentWord, setCurrentWord] = useState(null);
    const [stopTime, setStopTime] = useState(0);
    const [start, setStart] = useState(false);
    const [currentWordIndex, setCurrentWordIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [jsonList, setJsonList] = useState([]);
    const [currentDuration, setCurrentDuration] = useState(0); // For editing duration
    const [newWord, setNewWord] = useState(''); // For editing the current word

    const groq = new Groq({
        apiKey: process.env.REACT_APP_GEMINI_API_KEY, 
        dangerouslyAllowBrowser: true
    });

    useEffect(() => {
        let timer;
        if (start && jsonList.length > 0) {
            timer = setInterval(() => {
                setTime(prevTime => {
                    const newTime = prevTime + 10; // Increment by 10ms for smoother transitions
                    if (newTime >= stopTime) {
                        moveToNextWord();
                    }
                    return newTime;
                });
            }, 10);
        }
        return () => clearInterval(timer);

    }, [start, stopTime, jsonList]);

    const moveToNextWord = () => {
        if (currentWordIndex < jsonList.length - 1) {
            const nextIndex = currentWordIndex + 1;
            setTime(jsonList[nextIndex].startTime);
            setCurrentWordIndex(nextIndex);
            setCurrentWord(jsonList[nextIndex].word);
            setCurrentDuration(jsonList[nextIndex].duration); // Update duration for editing
            setStopTime(jsonList[nextIndex].endTime);
            setNewWord(jsonList[nextIndex].word); // Initialize new word input
        } else {
            setStart(false);
            setCurrentWord(null);
        }
    }

    useEffect(() => {
        updateHighlightedText();
    }, [currentWord, para, time, jsonList]);

    const startHandler = () => {
        if (jsonList.length > 0) {
            setTime(jsonList[currentWordIndex].startTime);
            setCurrentWord(jsonList[currentWordIndex].word);
            setCurrentDuration(jsonList[currentWordIndex].duration); // Update duration for editing
            setStopTime(jsonList[currentWordIndex].endTime);
            setStart(true);
            setNewWord(jsonList[currentWordIndex].word); // Initialize new word input
        }
    }

    const apiCall = async () => {
        setLoading(true);
        let prompt = `Generate a coherent passage simulating a 5-minute audio transcript in JSON format. The output should be a valid JSON object with exactly two keys:
        1. "wordsString": A space-separated string of all words in order.
        2. "wordsJson": An array of objects, each containing:
           - "word": The word spoken.
           - "startTime": The start time in milliseconds.
           - "endTime": The end time in milliseconds.
           - "duration": THE difference between starttime and endtime
        Ensure the times are realistic and sequential, with the duration of each word varying,
         but every word should have a duration longer than 10000 milliseconds to 150000 milliseconds. The total passage should span 5 minutes (300000 milliseconds) and contain 50 to 90 words.
        The paragraph should be between 50 to 80 words.
        The topic of the passage should be randomly chosen from the following list: cricket, football, peace, discipline. Do not use the same topic again. Provide a paragraph between 50 to 80 words.
        The response should contain a JSON object with no additional text, explanation, or markdown formatting. Ensure the JSON is valid and can be parsed without errors.
        Example structure (abbreviated for brevity):
        {
          "wordsString": "Space exploration has always fascinated humanity. From landing on the moon...",
          "wordsJson": [
            { "word": "Space", "startTime": 0, "endTime": 500, "duration": 500 },
            { "word": "exploration", "startTime": 500, "endTime": 1200, "duration": 700 },
            { "word": "has", "startTime": 1200, "endTime": 1500, "duration": 300 }
          ]
        }`;

        try {
            const chatCompletion = await groq.chat.completions.create({
                messages: [
                    {
                        role: "user",
                        content: prompt,
                    },
                ],
                model: "llama-3.1-8b-instant",
            });
            let responseContent = chatCompletion.choices[0]?.message?.content;
            responseContent = JSON.parse(responseContent);
            setPara(responseContent.wordsString);
            setJsonList(responseContent.wordsJson);
            setLoading(false);
        } catch (err) {
            apiCall();
        }
    }

    useEffect(() => {
        apiCall();
        const interval = setInterval(() => {
            setTime(prevTime => prevTime + 1);
        }, 1);

        return () => clearInterval(interval);
    }, []);

    const updateHighlightedText = () => {
        if (para && jsonList.length > 0) {
            const highlightedPara = para.split(' ').map(word => {
                const matchingWord = jsonList.find(item => item.word === word && item.startTime <= time && time <= item.endTime);
                return matchingWord
                    ? `<span class="bg-yellow-300 font-bold">${word}</span>`
                    : word;
            }).join(' ');
            document.getElementById('highlightedText').innerHTML = highlightedPara;
        }
    };

    const handleDurationChange = (e) => {
        setCurrentDuration(Number(e.target.value)); // Convert to number
    }

    const handleWordChange = () => {
        if (newWord.length === 0 || !currentWord ) {
            return;
        }
        const updatedJsonList = jsonList.map(item =>
            item.word === currentWord
                ? { ...item, word: newWord, duration: currentDuration }
                : item
        );
        setCurrentWord(newWord)
        setJsonList(updatedJsonList);
        setPara(updatedJsonList.map(item => item.word).join(' ')); // Update para with new words
        updateHighlightedText(); // Ensure highlighting is updated
    }

    return (
        <div className="p-4">
            <div className="mb-4">
                <div className="text-blue-400 text-lg font-medium mb-2">Current Word: {currentWord}</div>
                <div className="mb-2">
                    <label className="block text-sm font-medium mb-1">New Word:</label>
                    <input
                        type="text"
                        value={newWord}
                        onChange={(e) => setNewWord(e.target.value)}
                        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="mb-4">
                    <label className="block text-sm font-medium mb-1">Endtime (ms):</label>
                    <div
                      
                        
                        className="w-full p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >{jsonList.length>1?jsonList[currentWordIndex].endTime:0}</div>
                </div>
                <button
                    onClick={handleWordChange}
                    className="w-full py-2 px-4 bg-purple-600 text-white rounded-md hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                    Change
                </button>
            </div>

            <div className="text-lg mb-4">Current Time: {time}ms</div>

            <div className="flex gap-4 mb-4">
                <button
                    onClick={() => apiCall()}
                    className="flex items-center px-4 py-2 bg-pink-600 text-white rounded-md hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                    Generate
                    {loading && (
                        <Oval
                            className="ml-2"
                            visible={true}
                            height="20"
                            width="20"
                            strokeWidth="5"
                            strokeWidthSecondary="5"
                            color="#ffffff"
                            secondaryColor="#d2a6fc"
                            ariaLabel="oval-loading"
                        />
                    )}
                </button>
                <button
                    onClick={() => startHandler()}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    Start
                </button>
            </div>

            <div
                id="highlightedText"
                className="h-80 w-full overflow-auto p-4 border border-gray-300 rounded-md text-sm font-mono bg-gray-100"
                contentEditable={false}
            >
                {para}
            </div>
        </div>
    
    );
}

export default Transcipter;
