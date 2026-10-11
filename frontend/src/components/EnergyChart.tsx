import { useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent, PointerEvent as ReactPointerEvent } from 'react'

type Props = { solar: number[]; home: number[] }
const width = 700
const height = 225
const pad = { top: 18, right: 14, bottom: 30, left: 32 }

function coordinates(values: number[], maxValue: number) {
  const chartWidth = width - pad.left - pad.right
  const chartHeight = height - pad.top - pad.bottom
  return values.map((value, index) => ({
    x: pad.left + (chartWidth * index) / Math.max(1, values.length - 1),
    y: pad.top + chartHeight - (value / maxValue) * chartHeight,
  }))
}

function pathFor(values: number[], maxValue: number) {
  return coordinates(values, maxValue).map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`).join(' ')
}

function timeLabel(minute: number) {
  return new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(2000, 0, 1, Math.floor(minute / 60), minute % 60))
}

export default function EnergyChart({ solar: solarValues, home: homeValues }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null)
  const slotCount = Math.min(solarValues.length, homeValues.length)
  const solarData = solarValues.slice(0, slotCount)
  const homeData = homeValues.slice(0, slotCount)
  const maxValue = Math.max(1, Math.ceil(Math.max(...solarData, ...homeData, 0)))
  const solar = pathFor(solarData, maxValue)
  const home = pathFor(homeData, maxValue)
  const solarPoints = coordinates(solarData, maxValue)
  const homePoints = coordinates(homeData, maxValue)
  const area = solarPoints.length ? `${solar} L ${solarPoints.at(-1)?.x} ${height - pad.bottom} L ${solarPoints[0].x} ${height - pad.bottom} Z` : ''
  const activeSolar = activeIndex === null ? null : solarPoints[activeIndex]
  const activeHome = activeIndex === null ? null : homePoints[activeIndex]
  const activeTime = activeIndex === null ? null : timeLabel(activeIndex * 30)
  const tooltipLeft = activeIndex === null ? 50 : Math.min(89, Math.max(11, (solarPoints[activeIndex].x / width) * 100))
  const tooltipTop = activeIndex === null ? 8 : Math.max(3, (solarPoints[activeIndex].y / height) * 100 - 16)

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!slotCount) return
    const bounds = event.currentTarget.getBoundingClientRect()
    const ratio = (event.clientX - bounds.left) / bounds.width
    const plotRatio = Math.min(1, Math.max(0, (ratio * width - pad.left) / (width - pad.left - pad.right)))
    setActiveIndex(Math.round(plotRatio * (slotCount - 1)))
  }

  function handleKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (!slotCount || (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight')) return
    event.preventDefault()
    setActiveIndex((current) => {
      const step = event.key === 'ArrowRight' ? 1 : -1
      if (current === null) return event.key === 'ArrowRight' ? 0 : slotCount - 1
      return Math.min(slotCount - 1, Math.max(0, current + step))
    })
  }

  return (
    <div className="chart-wrap" role="group" tabIndex={0} aria-label="Forecast chart. Use the left and right arrow keys to inspect each time." onPointerMove={handlePointerMove} onPointerLeave={() => setActiveIndex(null)} onKeyDown={handleKeyDown}>
      {!slotCount ? <div className="chart-empty">No forecast data available for this date.</div> : <svg className="energy-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
        {[0, 1, 2, 3, 4].map((index) => {
          const value = Math.round((maxValue * index) / 4)
          const y = pad.top + (height - pad.top - pad.bottom) * (1 - index / 4)
          return <g key={index}><line x1={pad.left} y1={y} x2={width - pad.right} y2={y} className="chart-grid" /><text x={3} y={y + 4} className="chart-axis">{value}</text></g>
        })}
        <path d={area} className="chart-area" />
        <path d={solar} className="chart-line solar-line" />
        <path d={home} className="chart-line demand-line" />
        {activeIndex !== null && activeSolar && activeHome && <g className="chart-cursor"><line x1={activeSolar.x} y1={pad.top} x2={activeSolar.x} y2={height - pad.bottom} /><circle className="cursor-solar" cx={activeSolar.x} cy={activeSolar.y} r="4" /><circle className="cursor-demand" cx={activeHome.x} cy={activeHome.y} r="4" /></g>}
        {Array.from({ length: 9 }, (_, tick) => {
          const index = Math.min(slotCount - 1, Math.round((tick * (slotCount - 1)) / 8))
          const x = pad.left + ((width - pad.left - pad.right) * index) / Math.max(1, slotCount - 1)
          return <text key={tick} x={x} y={height - 7} textAnchor="middle" className="chart-axis">{timeLabel(index * 30)}</text>
        })}
      </svg>}
      <div className="chart-unit">kW</div>
      {activeIndex !== null && activeTime && <div className="chart-tooltip" style={{ left: `${tooltipLeft}%`, top: `${tooltipTop}%` }}>
        <strong>{activeTime}</strong>
        <span><i className="tooltip-dot solar-mark" />Solar <b>{solarData[activeIndex].toFixed(1)} kW</b></span>
        <span><i className="tooltip-dot demand-mark" />Demand <b>{homeData[activeIndex].toFixed(1)} kW</b></span>
      </div>}
    </div>
  )
}
