import { Pie } from 'react-chartjs-2';
import {
 Chart as ChartJS,
 ArcElement,
 Title,
 Tooltip,
 Legend,
} from 'chart.js';

ChartJS.register(ArcElement, Title, Tooltip, Legend);

const PieChart = ({ 
 title = 'Pie Chart',
 labels = [], 
 data = [],
 options = {},
 height = 400,
 backgroundColor = []
}) => {
 const colors = backgroundColor.length > 0 
 ? backgroundColor 
 : [
 '#FF6384',
 '#36A2EB',
 '#FFCE56',
 '#4BC0C0',
 '#9966FF',
 '#FF9F40',
 '#FF6384',
 '#C9CBCF',
 ];

 const defaultOptions = {
 responsive: true,
 maintainAspectRatio: false,
 plugins: {
 legend: {
 position: 'right',
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
 };

 const chartData = {
 labels,
 datasets: [
 {
 data,
 backgroundColor: colors.slice(0, data.length),
 borderColor: '#fff',
 borderWidth: 2,
 },
 ],
 };

 return (
 <div style={{ position: 'relative', height: `${height}px`, width: '100%' }}>
 <Pie data={chartData} options={{ ...defaultOptions, ...options }} />
 </div>
 );
};

export default PieChart;
