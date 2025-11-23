import React, { useEffect, useRef } from 'react';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  strokeWidth?: number;
  className?: string;
  min?: number;
  max?: number;
}

/**
 * Sparkline Component
 * 
 * Renders a simple SVG sparkline graph for visualizing trends.
 * Auto-scales to show the last N data points with smooth scrolling.
 */
const Sparkline: React.FC<SparklineProps> = ({
  data,
  width = 200,
  height = 40,
  color = '#0d6efd',
  strokeWidth = 1.5,
  className = '',
  min,
  max
}) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;

    // Clear previous content
    svgRef.current.innerHTML = '';

    // Calculate min and max for scaling
    const dataMin = min !== undefined ? min : Math.min(...data);
    const dataMax = max !== undefined ? max : Math.max(...data);
    const range = dataMax - dataMin || 1; // Avoid division by zero

    // Calculate points for the polyline
    const points = data.map((value, index) => {
      const x = (index / (data.length - 1)) * width;
      const y = height - ((value - dataMin) / range) * height;
      return `${x},${y}`;
    }).join(' ');

    // Create polyline element
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', points);
    polyline.setAttribute('fill', 'none');
    polyline.setAttribute('stroke', color);
    polyline.setAttribute('stroke-width', strokeWidth.toString());
    polyline.setAttribute('stroke-linejoin', 'round');
    polyline.setAttribute('stroke-linecap', 'round');

    // Create area fill (optional subtle background)
    const areaPoints = `0,${height} ${points} ${width},${height}`;
    const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    polygon.setAttribute('points', areaPoints);
    polygon.setAttribute('fill', color);
    polygon.setAttribute('opacity', '0.1');

    // Add elements to SVG
    svgRef.current.appendChild(polygon);
    svgRef.current.appendChild(polyline);

    // Add dots at the last point for emphasis
    if (data.length > 0) {
      const lastX = width;
      const lastY = height - ((data[data.length - 1] - dataMin) / range) * height;
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', lastX.toString());
      circle.setAttribute('cy', lastY.toString());
      circle.setAttribute('r', '2');
      circle.setAttribute('fill', color);
      svgRef.current.appendChild(circle);
    }
  }, [data, width, height, color, strokeWidth, min, max]);

  if (data.length === 0) {
    return (
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className={className}
      >
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          dominantBaseline="middle"
          fill="#999"
          fontSize="10"
        >
          No data
        </text>
      </svg>
    );
  }

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      className={className}
      style={{ display: 'block' }}
    />
  );
};

export default Sparkline;
