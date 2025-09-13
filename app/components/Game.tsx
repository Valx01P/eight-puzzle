// @ts-nocheck
'use client'
import {useRef, useState} from 'react'
import NextImage from 'next/image'

// constants
const GRID_SIZE = 3
const TILE_SIZE = 140 // size of each tile in pixels

const Game = () => {
  const inputRef = useRef(null)

  const [imageFile, setImageFile] = useState(null)
  const [imageFileURL, setImageFileURL] = useState(null)
  const [puzzleStarted, setPuzzleStarted] = useState(false)
  const [tiles, setTiles] = useState([]) // array of tile positions [0-8]
  const [turns, setTurns] = useState(0)
  const [history, setHistory] = useState([])
  const [puzzleSolved, setPuzzleSolved] = useState(false)
  const [showNumbers, setShowNumbers] = useState(false) // toggle tile numbers
  const [initialState, setInitialState] = useState([]) // store the initial shuffled state

  const createInitialTiles = () => {
    // puzzle array, 8 is the blank tile
    return [0, 1, 2, 3, 4, 5, 6, 7, 8]
  }

  const isSolvable = (arr) => {
    // count inversions (excluding the blank tile)
    const filtered = arr.filter(n => n !== 8)
    let inversions = 0
    for (let i = 0; i < filtered.length; i++) {
      for (let j = i + 1; j < filtered.length; j++) {
        if (filtered[i] > filtered[j]) inversions++
      }
    }
    return inversions % 2 === 0
  }

  const shuffleTiles = () => {
    let shuffled
    do {
      // ctart with solved state
      shuffled = [0, 1, 2, 3, 4, 5, 6, 7, 8]
      
      // Fisher-Yates shuffle
      for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        const temp = shuffled[i]
        shuffled[i] = shuffled[j]
        shuffled[j] = temp
      }
    } while (!isSolvable(shuffled) || checkWin(shuffled))
    
    return shuffled
  }

  const checkWin = (currentTiles) => {
    // check if tiles are in order 0,1,2,3,4,5,6,7,8
    for (let i = 0; i < 9; i++) {
      if (currentTiles[i] !== i) return false
    }
    return true
  }

  const getBlankIndex = (tilesArray) => {
    return tilesArray.indexOf(8)
  }

  const canSwap = (index, tilesArray) => {
    const blankIndex = getBlankIndex(tilesArray)
    const blankRow = Math.floor(blankIndex / GRID_SIZE)
    const blankCol = blankIndex % GRID_SIZE
    const tileRow = Math.floor(index / GRID_SIZE)
    const tileCol = index % GRID_SIZE
    
    // check if adjacent (not diagonal)
    const rowDiff = Math.abs(blankRow - tileRow)
    const colDiff = Math.abs(blankCol - tileCol)
    return (rowDiff === 1 && colDiff === 0) || (rowDiff === 0 && colDiff === 1)
  }

  const swapTiles = (index, tilesArray) => {
    const newTiles = [...tilesArray]
    const blankIndex = getBlankIndex(tilesArray)
    
    // simple swap
    const temp = newTiles[index]
    newTiles[index] = newTiles[blankIndex]
    newTiles[blankIndex] = temp
    
    return newTiles
  }

  const handleTileClick = (index) => {
    // don't allow moves if puzzle is solved
    if (puzzleSolved) return
    if (!canSwap(index, tiles)) return
    
    // ave current state to history
    setHistory(prev => [...prev, tiles])
    
    // swap tiles
    const newTiles = swapTiles(index, tiles)
    setTiles(newTiles)
    setTurns(turns + 1)
    
    // check for win
    if (checkWin(newTiles)) {
      setPuzzleSolved(true)
    }
  }

  const handleUndo = () => {
    if (history.length === 0) {
      setPuzzleStarted(false)
      return
    }
    
    const newHistory = [...history]
    const previousState = newHistory.pop()
    
    setHistory(newHistory)
    setTiles(previousState)
    setTurns(Math.max(0, turns - 1))
    
    // always set puzzleSolved to false when going back
    setPuzzleSolved(false)
  }

  const handleShuffle = () => {
    const newTiles = shuffleTiles()
    setTiles(newTiles)
    setInitialState(newTiles) // update initial state for reset
    setTurns(0)
    setHistory([])
    setPuzzleSolved(false)
  }

  const handleReset = () => {
    // reset to the initial shuffled state when puzzle started
    setTiles(initialState)
    setTurns(0)
    setHistory([])
    setPuzzleSolved(false)
  }

  const handleFileInputClick = () => {
    inputRef.current?.click()
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = (event) => {
      setImageFile(file)
      setImageFileURL(event.target.result)
    }
    reader.readAsDataURL(file)
  }

  const startPuzzle = () => {
    const initialTiles = shuffleTiles()
    setTiles(initialTiles)
    setInitialState(initialTiles) // store for reset
    setTurns(0)
    setHistory([])
    setPuzzleSolved(false)
    setPuzzleStarted(true)
  }

  return (
    <section className='bg-gray-950 flex justify-center items-center flex-col min-h-dvh py-32'>
      {!puzzleStarted ? (
        <div className='flex flex-col items-center'>
          <div className='w-[420px] h-[420px] bg-gray-900 border border-gray-800 flex items-center justify-center mb-8'>
            <div 
              className='w-12 h-12 animate-bounce' 
              style={{ backgroundColor: 'tomato' }}
            />
          </div>
          <div className='flex items-start justify-baseline flex-col min-w-[420px]'>
            <input
              type="file"
              accept="image/*"
              ref={inputRef}
              onChange={handleImageUpload}
              className='hidden'
            />
            <button
              type='button'
              onClick={handleFileInputClick}
              className="bg-gray-200 hover:bg-gray-300 text-black p-2"
            >
              {!imageFile ? 'Upload Image' : 'Change Image'}
            </button>
            {imageFile && (
              <div className='mt-4 mb-2 flex flex-col'>
                <p className='text-white'>Selected: {imageFile.name}</p>
                <NextImage 
                  src={imageFileURL}
                  width={260}
                  height={260}
                  alt='image_preview'
                  className='border border-gray-900 bg-white mb-4'
                />
                <button
                  className='bg-gray-200 w-fit hover:bg-gray-300 text-black p-2'
                  onClick={startPuzzle}
                >
                  Create 8-Puzzle
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <>
          <div 
            className='grid grid-cols-3 gap-1 bg-gray-800 p-1'
            style={{ width: '426px', height: '426px' }}
          >
            {tiles.map((tile, index) => {
              const isBlank = tile === 8
              const isMovable = canSwap(index, tiles)
              
              return (
                <div
                  key={index}
                  onClick={() => handleTileClick(index)}
                  className={`relative overflow-hidden bg-gray-900 ${
                    !puzzleSolved && isMovable
                      ? 'cursor-pointer hover:opacity-90 ring-2 ring-blue-500 ring-opacity-50'
                      : puzzleSolved 
                        ? '' 
                        : 'cursor-pointer hover:opacity-90'
                  }`}
                  style={{
                    width: TILE_SIZE + 'px',
                    height: TILE_SIZE + 'px',
                  }}
                >
                  {imageFileURL && (
                    <div
                      className={`w-full h-full ${isBlank ? 'opacity-20' : ''}`}
                      style={{
                        backgroundImage: `url(${imageFileURL})`,
                        backgroundSize: '420px 420px',
                        backgroundPosition: `-${(tile % GRID_SIZE) * TILE_SIZE}px -${Math.floor(tile / GRID_SIZE) * TILE_SIZE}px`,
                      }}
                    />
                  )}
                  {!isBlank && showNumbers && (
                    <div className='absolute top-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 rounded'>
                      {tile + 1}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <div className='flex flex-col items-center min-w-[420px] mt-8'>
            {puzzleSolved && <p className='text-green-400 mb-2'>Puzzle solved!</p>}
            <div className='flex flex-row items-center justify-between gap-4 mb-2 w-full'>
              <p className='text-white'>Turns: {turns}</p>
              <button 
                onClick={handleUndo} 
                className='bg-gray-200 hover:bg-gray-300 text-black p-2'
              >
                {history.length === 0 ? 'Exit Puzzle' : 'Undo Move'}
              </button>
              <button 
                onClick={handleShuffle} 
                className='bg-gray-200 hover:bg-gray-300 text-black p-2'
              >
                Shuffle
              </button>
              <button 
                onClick={() => setShowNumbers(!showNumbers)} 
                className='bg-gray-200 hover:bg-gray-300 text-black p-2'
              >
                {showNumbers ? 'Hide' : 'Show'} Numbers
              </button>
            </div>
            <div className='flex flex-row items-center justify-center w-full'>
              <button 
                onClick={handleReset} 
                className='bg-gray-200 hover:bg-gray-300 text-black p-2'
              >
                Reset to Start
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export default Game