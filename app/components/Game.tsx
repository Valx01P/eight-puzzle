// @ts-nocheck
'use client'
import {useRef, useEffect, useState} from 'react'
import NextImage from 'next/image'

// constants
const GRID_SIZE = 3
const CANVAS_SIZE = 420
const TILE_SIZE = CANVAS_SIZE / GRID_SIZE

const getAverageBrightness = (img) => {
  const tempCanvas = document.createElement('canvas')
  const tempCtx = tempCanvas.getContext('2d')
  tempCanvas.width = img.width
  tempCanvas.height = img.height

  // draw image off-screen
  tempCtx.drawImage(img, 0, 0)
  const imageData = tempCtx.getImageData(0, 0, img.width, img.height).data

  let totalLuminance = 0
  const step = 4 * 20 // sample every ~20 pixels for performance
  for (let i = 0; i < imageData.length; i += step) {
    const r = imageData[i]
    const g = imageData[i + 1]
    const b = imageData[i + 2]
    // ITU-R BT.709 perceived brightness formula
    totalLuminance += 0.2126 * r + 0.7152 * g + 0.0722 * b
  }

  const avgLuminance = totalLuminance / (imageData.length / step)
  return avgLuminance / 255 // normalize to 0..1 range
}

const Game = () => {
  const canvasRef = useRef(null)
  const inputRef = useRef(null)

  const [imageFile, setImageFile] = useState(null)
  const [imageFileURL, setImageFileURL] = useState(null)
  const [puzzleStarted, setPuzzleStarted] = useState(false)
  const [matrix, setMatrix] = useState([]) // puzzle state matrix
  const [canvasBgColor, setCanvasBgColor] = useState('white') // canvas background color

  // keep matrix ref in sync so event listeners always see the latest value
  const matrixRef = useRef(matrix)
  useEffect(() => {
    matrixRef.current = matrix
  }, [matrix])

  const findBlankPosition = (mat) => {
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        if (mat[r][c] === 0) return { r, c }
      }
    }
  }

  const isAdjacentToBlank = (r, c, mat) => {
    const { r: br, c: bc } = findBlankPosition(mat)
    return Math.abs(r - br) + Math.abs(c - bc) === 1
  }

  const swapWithBlank = (r, c, mat) => {
    const { r: br, c: bc } = findBlankPosition(mat)
    const newMat = mat.map((row) => [...row]) // clone matrix
    ;[newMat[r][c], newMat[br][bc]] = [newMat[br][bc], newMat[r][c]]
    return newMat
  }

  const redrawPuzzle = (ctx, img, mat, bg) => {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    drawPuzzle(ctx, img, mat)
  }

  const createInitialMatrix = () => {
    const arr = []
    let count = 1
    for (let row = 0; row < GRID_SIZE; row++) {
      const rowArr = []
      for (let col = 0; col < GRID_SIZE; col++) {
        rowArr.push(count)
        count++
      }
      arr.push(rowArr)
    }
    arr[GRID_SIZE - 1][GRID_SIZE - 1] = 0 // last is blank
    return arr
  }

  const flatten = (matrix) => matrix.flat()

  const shuffleMatrix = (mat) => {
    // simple shuffle (not guaranteed solvable, todo, make solvable all times)
    const flat = flatten(mat)
    for (let i = flat.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[flat[i], flat[j]] = [flat[j], flat[i]]
    }
    const newMatrix = []
    while (flat.length) newMatrix.push(flat.splice(0, GRID_SIZE))
    return newMatrix
  }
  
  const drawPuzzle = (ctx, img, mat) => {
    ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
    mat.forEach((row, r) => {
      row.forEach((tile, c) => {
        if (tile === 0) return // skip blank
        const sx = ((tile - 1) % GRID_SIZE) * TILE_SIZE
        const sy = Math.floor((tile - 1) / GRID_SIZE) * TILE_SIZE
        const dx = c * TILE_SIZE
        const dy = r * TILE_SIZE
        ctx.drawImage(img, sx, sy, TILE_SIZE, TILE_SIZE, dx, dy, TILE_SIZE, TILE_SIZE)
      })
    })

    // draw grid lines
    ctx.strokeStyle = canvasBgColor === 'white' ? 'black' : 'white'
    ctx.lineWidth = 2
    for (let i = 1; i < GRID_SIZE; i++) {
      ctx.beginPath()
      ctx.moveTo(i * TILE_SIZE, 0)
      ctx.lineTo(i * TILE_SIZE, CANVAS_SIZE)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, i * TILE_SIZE)
      ctx.lineTo(CANVAS_SIZE, i * TILE_SIZE)
      ctx.stroke()
    }
  }

  const handleFileInputClick = () => {
    inputRef.current?.click()
  }

  const handleImageUpload = (e) => {
    const file = e.target.files[0]

    if (!file) return

    const localImageURL = URL.createObjectURL(file)
    const img = new window.Image()

    img.onload = () => {
      // normalize to square before saving to state
      const tempCanvas = document.createElement('canvas')
      const tempCtx = tempCanvas.getContext('2d')
      tempCanvas.width = CANVAS_SIZE
      tempCanvas.height = CANVAS_SIZE

      const scale = Math.max(CANVAS_SIZE / img.width, CANVAS_SIZE / img.height)
      const scaledWidth = img.width * scale
      const scaledHeight = img.height * scale
      const offsetX = (CANVAS_SIZE - scaledWidth) / 2
      const offsetY = (CANVAS_SIZE - scaledHeight) / 2

      // fill background with white to avoid transparent corners
      tempCtx.fillStyle = 'white'
      tempCtx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)

      tempCtx.drawImage(img, offsetX, offsetY, scaledWidth, scaledHeight)

      // convert to a new URL for both preview + puzzle
      const normalizedDataURL = tempCanvas.toDataURL('image/png')

      setImageFile(file)
      setImageFileURL(normalizedDataURL)
      
      // cleanup object URL
      URL.revokeObjectURL(localImageURL)
    }

    img.src = localImageURL
  }

  // waiting state for canvas
  useEffect(() => {
    if (puzzleStarted) return // stop animating once puzzle starts

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const boxSize = 50

    // position + velocity
    let x = 0, y = (CANVAS_SIZE / 2) - (boxSize / 2)
    let vx = 0.3, vy = 0

    let animationFrameId

    function draw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // draw box
      ctx.fillStyle = 'tomato'
      ctx.fillRect(x, y, boxSize, boxSize)

      // update position
      x += vx
      y += vy

      // bounce horizontally by flipping vector
      if (x <= 0 || x + boxSize >= canvas.width) {
        vx = -vx
        x += vx
      }

      // bounce vertically by flipping vector
      if (y <= 0 || y + boxSize >= canvas.height) {
        vy = -vy
        y += vy
      }

      animationFrameId = requestAnimationFrame(draw)
    }

    draw()

    return () => cancelAnimationFrame(animationFrameId)
  }, [puzzleStarted])


  useEffect(() => {
    if (!puzzleStarted || !imageFileURL) return
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const img = new window.Image()

    img.onload = () => {
      // clear any previous content
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // detect brightness of image to set canvas bg
      const brightness = getAverageBrightness(img)
      const newBg = brightness < 0.5 ? 'white' : 'black'
      setCanvasBgColor(newBg)

      // draw puzzle
      const initialMatrix = shuffleMatrix(createInitialMatrix())
      setMatrix(initialMatrix)
      matrixRef.current = initialMatrix

      ctx.fillStyle = newBg
      ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE)
      drawPuzzle(ctx, img, initialMatrix)
    }

    img.src = imageFileURL

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const row = Math.floor(mouseY / TILE_SIZE)
      const col = Math.floor(mouseX / TILE_SIZE)

      if (isAdjacentToBlank(row, col, matrixRef.current)) {
        canvas.style.cursor = 'pointer'
      } else {
        canvas.style.cursor = 'default'
      }
    }

    const handleClick = (e) => {
      const rect = canvas.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top

      const row = Math.floor(mouseY / TILE_SIZE)
      const col = Math.floor(mouseX / TILE_SIZE)

      if (isAdjacentToBlank(row, col, matrixRef.current)) {
        const newMatrix = swapWithBlank(row, col, matrixRef.current)
        setMatrix(newMatrix)
        matrixRef.current = newMatrix
        redrawPuzzle(ctx, img, newMatrix, canvasBgColor)
      }
    }

    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('click', handleClick)

    return () => {
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('click', handleClick)
    }
  }, [puzzleStarted, imageFileURL])

  return (
    <section className='bg-gray-950 flex justify-base items-center flex-col min-h-dvh py-32'>
      <canvas
        ref={canvasRef}
        width={CANVAS_SIZE}
        height={CANVAS_SIZE}
        className={`border border-gray-900 min-w-[${CANVAS_SIZE}px]`}
        style={{ backgroundColor: canvasBgColor }}
      />
      <div className={`flex items-start justify-baseline flex-col min-w-[${CANVAS_SIZE}px] mt-8`}>
      { !puzzleStarted
      ?
        <>
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
              className="bg-gray-200 hover:bg-gray-300 text-black p-2 hover:cursor-pointer"
            >
              { !imageFile ? 'Upload Image' : 'Change Image' }
            </button>
            { imageFile &&
              <div className='mt-4 mb-2 flex flex-col'>
                <p>Selected: {imageFile.name}</p>
                <NextImage 
                  src={imageFileURL}
                  width={260}
                  height={260}
                  alt='image_preview'
                  className='border border-gray-900 bg-white'
                />
                <button
                  className='bg-gray-200 w-fit hover:bg-gray-300 text-black p-2 hover:cursor-pointer'
                  onClick={() => setPuzzleStarted(true)}
                >
                  Create 8-Puzzle
                </button>
              </div>
            }
        </>
      :
        <>
          <h1>Puzzle started</h1>
        </>
      }
      </div>
    </section>
  )
}

export default Game
