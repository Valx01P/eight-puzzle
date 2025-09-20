// @ts-nocheck
'use client'
import {useRef, useState, useEffect} from 'react'
import NextImage from 'next/image'

// constants
const GRID_SIZE = 3

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
  
  // solver states
  const [solverOpen, setSolverOpen] = useState(false)
  const [solverAlgorithm, setSolverAlgorithm] = useState('*astar') // '*astar', 'bfs', 'dfs'
  const [solverSteps, setSolverSteps] = useState([])
  const [currentSolverStep, setCurrentSolverStep] = useState(0)
  const [solverTurns, setSolverTurns] = useState(0)
  const [savedStateBeforeSolver, setSavedStateBeforeSolver] = useState(null)
  const [savedTurnsBeforeSolver, setSavedTurnsBeforeSolver] = useState(0)
  const [savedHistoryBeforeSolver, setSavedHistoryBeforeSolver] = useState([])
  const [solverTime, setSolverTime] = useState(null) // to store the algorithm's execution time
  const [solverMessage, setSolverMessage] = useState(null) // to show messages like DFS failure

  // responsive states
  const [tileSize, setTileSize] = useState(140)
  const [gridContainerSize, setGridContainerSize] = useState(426)
  const [contentWidth, setContentWidth] = useState(420)

  useEffect(() => {
    const calculateSize = () => {
      // the maximum width for the puzzle's image content area
      const maxWidth = 420
      
      // padding from the screen edges to prevent touching the sides
      const screenPadding = 30
      
      // calculate the available width in the viewport
      const availableWidth = window.innerWidth - screenPadding
      
      // determine the base width for the tiles grid (cannot exceed maxwidth)
      const gridContentWidth = Math.min(maxWidth, availableWidth)
      
      // calculate the size of a single tile, ensuring it's an integer
      const newTileSize = Math.floor(gridContentWidth / GRID_SIZE)
      
      // calculate the full container size, adding 6px for borders/gaps
      // this is based on the original code's 426px container for 420px (3*140) of tiles
      const newContainerSize = (newTileSize * GRID_SIZE) + 6
      const newContentWidth = newTileSize * GRID_SIZE
      
      setTileSize(newTileSize)
      setGridContainerSize(newContainerSize)
      setContentWidth(newContentWidth)
    };
    
    // calculate size on initial render
    calculateSize()
    
    // add event listener for window resize
    window.addEventListener('resize', calculateSize)
    
    // cleanup function to remove the event listener
    return () => window.removeEventListener('resize', calculateSize)
  }, [])

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
      // start with solved state
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

  // get all possible moves from a state
  const getPossibleMoves = (state) => {
    const blankIndex = getBlankIndex(state)
    const moves = []
    
    for (let i = 0; i < 9; i++) {
      if (canSwap(i, state)) {
        moves.push({
          index: i,
          resultState: swapTiles(i, state)
        })
      }
    }
    
    return moves
  }

  // manhattan distance heuristic for A*
  const getManhattanDistance = (state) => {
    let distance = 0
    for (let i = 0; i < 9; i++) {
      if (state[i] !== 8) { // skip blank tile
        const currentRow = Math.floor(i / GRID_SIZE)
        const currentCol = i % GRID_SIZE
        const targetRow = Math.floor(state[i] / GRID_SIZE)
        const targetCol = state[i] % GRID_SIZE
        distance += Math.abs(currentRow - targetRow) + Math.abs(currentCol - targetCol)
      }
    }
    return distance
  }

  // A* solver
  const solveAStar = (startState) => {
    const visited = new Set()
    const queue = [{
      state: startState,
      path: [],
      cost: 0,
      heuristic: getManhattanDistance(startState)
    }]
    
    while (queue.length > 0) {
      // sort by f(n) = g(n) + h(n)
      queue.sort((a, b) => (a.cost + a.heuristic) - (b.cost + b.heuristic))
      const current = queue.shift()
      
      if (checkWin(current.state)) {
        return current.path
      }
      
      const stateKey = current.state.join(',')
      if (visited.has(stateKey)) continue
      visited.add(stateKey)
      
      const moves = getPossibleMoves(current.state)
      for (const move of moves) {
        const newStateKey = move.resultState.join(',')
        if (!visited.has(newStateKey)) {
          queue.push({
            state: move.resultState,
            path: [...current.path, move.resultState],
            cost: current.cost + 1,
            heuristic: getManhattanDistance(move.resultState)
          })
        }
      }
    }
    
    return [] // no solution found
  }

  // BFS solver
  const solveBFS = (startState) => {
    const visited = new Set()
    const queue = [{
      state: startState,
      path: []
    }]
    
    visited.add(startState.join(','))
    
    while (queue.length > 0) {
      const current = queue.shift()
      
      if (checkWin(current.state)) {
        return current.path
      }
      
      const moves = getPossibleMoves(current.state)
      for (const move of moves) {
        const stateKey = move.resultState.join(',')
        if (!visited.has(stateKey)) {
          visited.add(stateKey)
          queue.push({
            state: move.resultState,
            path: [...current.path, move.resultState]
          })
        }
      }
    }
    
    return [] // no solution found
  }

  // DFS solver (with depth limit to prevent infinite loops)
  const solveDFS = (startState, maxDepth = 50) => {
    const visited = new Set()
    const stack = [{
      state: startState,
      path: [],
      depth: 0
    }]
    
    while (stack.length > 0) {
      const current = stack.pop()
      
      if (checkWin(current.state)) {
        return current.path // return solution path on success
      }
      
      if (current.depth >= maxDepth) continue
      
      const stateKey = current.state.join(',')
      if (visited.has(stateKey)) continue
      visited.add(stateKey)
      
      const moves = getPossibleMoves(current.state)
      for (const move of moves) {
        const newStateKey = move.resultState.join(',')
        if (!visited.has(newStateKey)) {
          stack.push({
            state: move.resultState,
            path: [...current.path, move.resultState],
            depth: current.depth + 1
          })
        }
      }
    }
    
    return null // return null if no solution is found within the depth limit
  }

  const runSolver = (algorithm, state) => {
    // this is a helper to run the selected algorithm and handle timing and DFS failure
    setSolverTime(null)
    setSolverMessage(null)
    
    const startTime = performance.now()
    
    let solution
    const algorithmToRun = algorithm.startsWith('*') ? algorithm.substring(1) : algorithm
    
    switch (algorithmToRun) {
      case 'astar':
        solution = solveAStar(state)
        break
      case 'bfs':
        solution = solveBFS(state)
        break
      case 'dfs':
        solution = solveDFS(state)
        break
      default:
        solution = []
    }

    const endTime = performance.now()
    setSolverTime(endTime - startTime)

    if (algorithmToRun === 'dfs' && solution === null) {
      setSolverMessage('DFS failed: Max depth reached or no solution found.')
      setSolverSteps([])
    } else {
      setSolverSteps(solution || [])
    }
  }

  const handleSolve = () => {
    if (solverOpen) {
      // close solver
      setSolverOpen(false)
      setSolverTime(null)
      setSolverMessage(null)

      // restore previous state
      if (savedStateBeforeSolver) {
        setTiles(savedStateBeforeSolver)
        setTurns(savedTurnsBeforeSolver)
        setHistory(savedHistoryBeforeSolver)
        setPuzzleSolved(checkWin(savedStateBeforeSolver))
      }
    } else {
      // open solver
      setSolverOpen(true)
      setSavedStateBeforeSolver(tiles)
      setSavedTurnsBeforeSolver(turns)
      setSavedHistoryBeforeSolver(history)
      
      setCurrentSolverStep(0)
      setSolverTurns(0)
      setPuzzleSolved(false)

      runSolver(solverAlgorithm, tiles)
    }
  }

  const handleNextStep = () => {
    if (currentSolverStep < solverSteps.length) {
      setTiles(solverSteps[currentSolverStep])
      setCurrentSolverStep(currentSolverStep + 1)
      setSolverTurns(currentSolverStep + 1)
      if (checkWin(solverSteps[currentSolverStep])) {
        setPuzzleSolved(true)
      }
    }
  }

  const handlePrevStep = () => {
    if (currentSolverStep > 0) {
      const prevStep = currentSolverStep - 1
      const prevState = prevStep === 0 ? savedStateBeforeSolver : solverSteps[prevStep - 1]
      setTiles(prevState)
      setCurrentSolverStep(prevStep)
      setSolverTurns(prevStep)
      setPuzzleSolved(false)
    }
  }

  const handleTileClick = (index) => {
    // don't allow moves if puzzle is solved or solver is open
    if (puzzleSolved || solverOpen) return
    if (!canSwap(index, tiles)) return
    
    // save current state to history
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
    if (solverOpen) return // aon't allow undo when solver is open
    
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
    if (solverOpen) return // don't allow shuffle when solver is open
    
    const newTiles = shuffleTiles()
    setTiles(newTiles)
    setInitialState(newTiles) // update initial state for reset
    setTurns(0)
    setHistory([])
    setPuzzleSolved(false)
  }

  const handleReset = () => {
    if (solverOpen) return // don't allow reset when solver is open
    
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

  const handleAlgorithmChange = (e) => {
    const newAlgorithm = e.target.value
    setSolverAlgorithm(newAlgorithm)
    
    // reset steps and restore the initial board state for the new calculation
    setCurrentSolverStep(0)
    setSolverTurns(0)
    setTiles(savedStateBeforeSolver)
    setPuzzleSolved(false)

    // re-run the solver with the new algorithm
    runSolver(newAlgorithm, savedStateBeforeSolver)
  }
  
  const dynamicButtonText = "whitespace-nowrap text-[clamp(0.7rem,2.5vw,0.9rem)]";
  const dynamicHeaderText = "text-[clamp(1rem,4vw,1.25rem)]";
  const dynamicUIText = "text-[clamp(0.8rem,2.5vw,1rem)]";

  return (
    <section className='bg-gray-950 flex justify-center items-center flex-col min-h-dvh py-8 sm:py-16 md:py-32 px-4'>
      {/* ENHANCED TITLE SECTION */}
      <div className="flex flex-col items-center mb-12">
        {/* TITLE CONTAINER WITH BACKGROUND */}
        <div className="relative mb-6">
          {/* BACKGROUND GLOW EFFECT */}
          <div className="absolute inset-0 bg-gradient-to-r from-cyan-400/20 via-blue-500/20 to-purple-500/20 blur-xl rounded-3xl transform scale-110"></div>
          
          {/* MAIN TITLE CONTAINER */}
          <div className="relative rounded-2xl px-8 py-6 flex items-center justify-center">
            {/* TITLE TEXT */}
            <h1 className="text-center text-[clamp(2rem,7vw,4rem)] leading-tight" 
                style={{ fontFamily: "'Press Start 2P', monospace" }}>
              <div className="flex flex-wrap justify-center items-center gap-6">
                {['8-BIT', 'PUZZLE', 'GAME'].map((word, wordIndex) => (
                  <span key={wordIndex} className="flex whitespace-nowrap">
                    {word.split('').map((letter, letterIndex) => (
                      <span
                        key={`${wordIndex}-${letterIndex}`}
                        className="inline-block transition-all duration-300 hover:scale-125 hover:-translate-y-2 animate-bounce bg-gradient-to-b from-white via-cyan-200 to-cyan-400 bg-clip-text text-transparent"
                        style={{ 
                          animationDelay: `${(wordIndex * word.length + letterIndex) * 100}ms`,
                          filter: 'drop-shadow(0 0 10px rgba(34,211,238,0.5)) drop-shadow(0 0 20px rgba(34,211,238,0.3))'
                        }}
                        onMouseEnter={(e) => {
                          e.target.style.filter = 'drop-shadow(0 0 15px rgba(34,211,238,0.8)) drop-shadow(0 0 30px rgba(34,211,238,0.6))'
                        }}
                        onMouseLeave={(e) => {
                          e.target.style.filter = 'drop-shadow(0 0 10px rgba(34,211,238,0.5)) drop-shadow(0 0 20px rgba(34,211,238,0.3))'
                        }}
                      >
                        {letter}
                      </span>
                    ))}
                  </span>
                ))}
              </div>
            </h1>
          </div>
        </div>
        
        {/* SUBTITLE */}
        <p className="text-cyan-300/80 text-center text-[clamp(0.8rem,2vw,1.2rem)] font-mono tracking-wider">
          Classic sliding puzzle reimagined
        </p>
      </div>
      
      {/* BEFORE PUZZLE HAS STARTED */}
      {!puzzleStarted ? (
        <div className='flex flex-col items-center w-full'>
          {/* ENHANCED WAITING SCREEN */}
          <div 
            className='bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 border-2 border-cyan-400/30 rounded-2xl flex items-center justify-center mb-8 relative overflow-hidden shadow-2xl'
            style={{ width: `${contentWidth}px`, height: `${contentWidth}px` }}
          >
            {/* BACKGROUND PATTERN */}
            <div className="absolute inset-0 opacity-10">
              <div className="grid grid-cols-3 gap-1 w-full h-full p-4">
                {[...Array(9)].map((_, i) => (
                  <div 
                    key={i} 
                    className="bg-cyan-400 rounded-sm"
                    style={{
                      animationDelay: `${i * 150}ms`,
                      animation: 'pulse 2s infinite'
                    }}
                  />
                ))}
              </div>
            </div>
            
            {/* MAIN ANIMATION */}
            <div className="relative z-10 flex flex-col items-center">
              {/* ANIMATED PUZZLE PIECES */}
              <div className="grid grid-cols-3 gap-2 mb-6">
                {[...Array(8)].map((_, i) => (
                  <div
                    key={i}
                    className="w-8 h-8 bg-gradient-to-br from-cyan-400 to-blue-500 rounded-sm shadow-lg transform transition-all duration-1000"
                    style={{
                      animationDelay: `${i * 200}ms`,
                      animation: 'bounce 2s infinite, pulse 3s infinite alternate'
                    }}
                  />
                ))}
                {/* Empty space for the missing piece */}
                <div className="w-8 h-8 border-2 border-dashed border-cyan-400/50 rounded-sm flex items-center justify-center">
                  <div className="w-2 h-2 bg-cyan-400/50 rounded-full animate-ping"></div>
                </div>
              </div>
              
              {/* LOADING TEXT */}
              <div className="text-center">
                <h3 className="text-cyan-300 text-xl font-mono mb-2 animate-pulse">
                  Ready to Puzzle?
                </h3>
                <p className="text-cyan-400/70 text-sm font-mono">
                  Upload an image to get started
                </p>
              </div>
            </div>
            
            {/* CORNER ACCENTS */}
            <div className="absolute top-2 left-2 w-4 h-4 border-l-2 border-t-2 border-cyan-400/50"></div>
            <div className="absolute top-2 right-2 w-4 h-4 border-r-2 border-t-2 border-cyan-400/50"></div>
            <div className="absolute bottom-2 left-2 w-4 h-4 border-l-2 border-b-2 border-cyan-400/50"></div>
            <div className="absolute bottom-2 right-2 w-4 h-4 border-r-2 border-b-2 border-cyan-400/50"></div>
          </div>
          {/* IMAGE UPLOAD AND PREVIEW */}
          <div 
            className='flex items-start justify-baseline flex-col'
            style={{ width: `${contentWidth}px` }}
          >
            {/* HIDDEN INPUT, WITH BUTTON TARGETING IT, BECAUSE IT LOOKS BETTER */}
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
              className={`bg-gray-200 hover:bg-gray-300 text-black p-2 rounded ${dynamicButtonText}`}
            >
              {!imageFile ? 'Upload Image' : 'Change Image'}
            </button>
            {/* IMAGE PREVIEW AND CONFIRMATION */}
            {imageFile && (
              <div className='mt-4 mb-2 flex flex-col'>
                <p className='text-white truncate'>Selected: {imageFile.name}</p>
                <NextImage 
                  src={imageFileURL}
                  width={0}
                  height={0}
                  sizes="100vw"
                  alt='image_preview'
                  className='border border-gray-900 bg-white mb-4 mt-2 w-full h-auto max-w-[260px]'
                />
                <button
                  className={`bg-gray-200 w-fit hover:bg-gray-300 text-black p-2 rounded ${dynamicButtonText}`}
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
          {/* PUZZLE STARTED */}
          {/* PUZZLE DISPLAY */}
          <div 
            className='grid grid-cols-3 gap-1 bg-gray-800 p-1'
            style={{ width: `${gridContainerSize}px`, height: `${gridContainerSize}px` }}
          > 
            {/* CREATE AND DISPLAY ALL THE TILES IN OUR PUZZLE GRID */}
            {tiles.map((tile, index) => {
              const isBlank = tile === 8
              const isMovable = canSwap(index, tiles)
              
              return (
                <div
                  key={index}
                  onClick={() => handleTileClick(index)}
                  className={`relative overflow-hidden bg-gray-900 transition-opacity duration-150 ${
                    !puzzleSolved && !solverOpen && isMovable
                      ? 'cursor-pointer hover:opacity-90 ring-2 ring-blue-500 ring-opacity-50'
                      : (puzzleSolved || solverOpen)
                        ? '' 
                        : 'cursor-pointer hover:opacity-90'
                  }`}
                  style={{
                    width: tileSize + 'px',
                    height: tileSize + 'px',
                  }}
                >
                  {/* TILE CONTENT, THE IMAGE PIECE SHOWN, CALCULATED FROM INDEX */}
                  {imageFileURL && (
                    <div
                      className={`w-full h-full ${isBlank ? 'opacity-20' : ''}`}
                      style={{
                        backgroundImage: `url(${imageFileURL})`,
                        backgroundSize: `${contentWidth}px ${contentWidth}px`,
                        backgroundPosition: `-${(tile % GRID_SIZE) * tileSize}px -${Math.floor(tile / GRID_SIZE) * tileSize}px`,
                      }}
                    />
                  )}
                  {!isBlank && showNumbers && (
                    <div className='absolute top-1 left-1 bg-black bg-opacity-50 text-white text-xs px-1 py-0.5 rounded-sm'>
                      {tile + 1}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          
          {/* WHEN PUZZLE SOLVED BY PLAYER */}
          {puzzleSolved && !solverOpen && <p className={`text-green-400 mt-4 mb-2 ${dynamicHeaderText}`}>Puzzle solved!</p>}
          {/* WHEN PUZZLE SOLVED BY SOLVER (ALGORITHMS) */}
          {puzzleSolved && solverOpen && <p className={`text-green-400 mt-4 mb-2 ${dynamicHeaderText}`}>Solver completed!</p>}
          
          {/* WHEN SOLVER IS SELECTED, SHOW SOLVER CONTROL MENU */}
          {solverOpen && (
            <div 
              className='flex flex-col items-center mt-4 p-4 bg-gray-800 rounded'
              style={{ width: `${contentWidth}px` }}
            >
              <div className='flex flex-row items-center gap-4 mb-4'>
                <label className={`text-white ${dynamicUIText}`}>Algorithm:</label>
                {/* SELECT ALGORITHM TO SOLVE WITH */}
                <select 
                  value={solverAlgorithm} 
                  onChange={handleAlgorithmChange}
                  className={`bg-gray-700 text-white p-1 rounded ${dynamicUIText}`}
                >
                  <option value='*astar'>*A* Search</option>
                  <option value='bfs'>BFS</option>
                  <option value='dfs'>DFS</option>
                </select>
              </div>
              
              {/* BACK AND FORWARD STEP BUTTONS FOR SOLVER */}
              <div className='flex flex-row items-center gap-2 mb-4'>
                <button
                  onClick={handlePrevStep}
                  disabled={currentSolverStep === 0}
                  className={`bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:opacity-50 text-white p-2 rounded ${dynamicButtonText}`}
                >
                  ← Prev
                </button>
                <button
                  onClick={handleNextStep}
                  disabled={currentSolverStep >= solverSteps.length}
                  className={`bg-gray-600 hover:bg-gray-500 disabled:bg-gray-700 disabled:opacity-50 text-white p-2 rounded ${dynamicButtonText}`}
                >
                  Next →
                </button>
              </div>
              {/* CALCULATION TIME FOR SOLVER ALGORITHM */}
              {solverTime !== null && (
                <div className={`text-white mb-2 ${dynamicUIText}`}>
                  Calculation Time: {solverTime.toFixed(2)} ms
                </div>
              )}

              {/* ALGORITHM STEPS, OR MESSAGE FOR DFS CALL STACK EXCEEDED */}
              <div className={`text-white mb-2 text-center ${dynamicUIText}`}>
                {solverMessage ? (
                  <span className='text-yellow-400'>{solverMessage}</span>
                ) : (
                  <span>Total Steps: {solverSteps.length} | Current: {currentSolverStep}</span>
                )}
              </div>
            </div>
          )}
          
          {/* DEFAULT PUZZLE MENU FOR PLAYER */}
          <div 
            className='flex flex-col items-center mt-8'
            style={{ width: `${contentWidth}px` }}
          >
            {/* FIRST ROW */}
            <div className='flex flex-row items-center justify-center gap-4 mb-2 w-full'>
              <p className={`text-white ${dynamicButtonText}`}>Turns: {solverOpen ? solverTurns : turns}</p>
              {/* GO BACK ONE STEP BUTTON */}
              <button 
                onClick={handleUndo}
                disabled={solverOpen}
                className={`bg-gray-200 hover:bg-gray-300 disabled:bg-gray-400 disabled:opacity-50 text-black p-2 rounded ${dynamicButtonText}`}
              >
                {history.length === 0 ? 'Exit Puzzle' : 'Undo Move'}
              </button>
              {/* SHUFFLE PUZZLE BUTTON */}
              <button 
                onClick={handleShuffle}
                disabled={solverOpen}
                className={`bg-gray-200 hover:bg-gray-300 disabled:bg-gray-400 disabled:opacity-50 text-black p-2 rounded ${dynamicButtonText}`}
              >
                Shuffle
              </button>
              {/* BUTTON TO OPTIONALLY SHOW THE TILE INDEXES TO PLAYER */}
              <button 
                onClick={() => setShowNumbers(!showNumbers)} 
                className={`bg-gray-200 hover:bg-gray-300 disabled:bg-gray-400 disabled:opacity-50 text-black p-2 rounded ${dynamicButtonText}`}
              >
                {showNumbers ? 'Hide' : 'Show'} Numbers
              </button>
            </div>

            {/* SECOND ROW */}
            <div className='flex flex-row items-center justify-center gap-4 w-full'>
              {/* RESET PUZZLE BOARD BUTTON, RESETS BACK TO INITIAL STEP */}
              <button 
                onClick={handleReset}
                disabled={solverOpen}
                className={`bg-gray-200 hover:bg-gray-300 disabled:bg-gray-400 disabled:opacity-50 text-black p-2 rounded ${dynamicButtonText}`}
              >
                Reset to Start
              </button>
              {/* OPEN SOLVER MENU, SHOWS STEP BY STEP SOLUTION WITH DIFFERENT ALGORITHMS */}
              <button 
                onClick={handleSolve}
                className={`bg-blue-500 hover:bg-blue-400 text-white p-2 rounded ${dynamicButtonText}`}
              >
                {solverOpen ? 'Close Solver' : 'Solve'}
              </button>
            </div>
          </div>
        </>
      )}
    </section>
  )
}

export default Game