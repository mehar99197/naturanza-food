import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';

ChartJS.register(
  RadarController,
  RadialLinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const RadarChart = ({ 
 title = 'Radar Chart',
 labels = [], 
 datasets = [],
 options = {},
 height = 400
}) => {
 const defaultOptions = {
 responsive: true,
 maintainAspectRatio: false,
 plugins: {
 legend: {
 position: 'top',
 },
 title: {
 display: true,
 text: title,
 font: {
 size: 16,
 weight: 'bold',
 },
 },
 },
 scales: {
 r: {
 beginAtZero: true,
 },
 },
 };

 const chartData = {
 labels,
 datasets: datasets.map((dataset, index) => ({
 label: dataset.label || `Dataset ${index + 1}`,
 data: dataset.data || [],
 borderColor: dataset.borderColor || `hsl(${index * 60}, 70%, 60%)`,
 backgroundColor: dataset.backgroundColor || `hsl(${index * 60}, 70%, 90%)`,
 fill: true,
 tension: 0.4,
 ...dataset,
 })),
 };

 const mergedOptions = {
 ...defaultOptions,
 ...options,
 plugins: {
 ...defaultOptions.plugins,
 ...options?.plugins,
 legend: {
 ...defaultOptions.plugins.legend,
 ...options?.plugins?.legend,
 },
 title: {
 ...defaultOptions.plugins.title,
 ...options?.plugins?.title,
 },
 },
 scales: {
 ...defaultOptions.scales,
 ...options?.scales,
 r: {
 ...defaultOptions.scales.r,
 ...options?.scales?.r,
 },
 },
 };

 return (
 <div style={{ position: 'relative', height: `${height}px`, width: '100%' }}>
 <Radar data={chartData} options={mergedOptions} />
 </div>
 );
};

export default RadarChart;
