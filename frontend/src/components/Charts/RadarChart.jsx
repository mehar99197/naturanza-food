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
} from 'chart.js';

ChartJS.register(
 RadarController,
 RadialLinearScale,
 PointElement,
 LineElement,
 Title,
 Tooltip,
 Legend
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

 return (
 <div style={{ position: 'relative', height: `${height}px`, width: '100%' }}>
 <Radar data={chartData} options={{ ...defaultOptions, ...options }} />
 </div>
 );
};

export default RadarChart;
