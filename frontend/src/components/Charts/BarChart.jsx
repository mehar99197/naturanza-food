import { Bar } from 'react-chartjs-2';
import {
 Chart as ChartJS,
 CategoryScale,
 LinearScale,
 BarElement,
 Title,
 Tooltip,
 Legend,
} from 'chart.js';

ChartJS.register(
 CategoryScale,
 LinearScale,
 BarElement,
 Title,
 Tooltip,
 Legend
);

const BarChart = ({ 
 title = 'Bar Chart',
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
 y: {
 beginAtZero: true,
 },
 },
 };

 const chartData = {
 labels,
 datasets: datasets.map((dataset, index) => ({
 label: dataset.label || `Dataset ${index + 1}`,
 data: dataset.data || [],
 backgroundColor: dataset.backgroundColor || `hsl(${index * 60}, 70%, 60%)`,
 borderColor: dataset.borderColor || `hsl(${index * 60}, 70%, 40%)`,
 borderWidth: 1,
 ...dataset,
 })),
 };

 return (
 <div style={{ position: 'relative', height: `${height}px`, width: '100%' }}>
 <Bar data={chartData} options={{ ...defaultOptions, ...options }} />
 </div>
 );
};

export default BarChart;
